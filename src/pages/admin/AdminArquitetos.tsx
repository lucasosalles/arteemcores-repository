import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Loader2, HardHat, Wrench, ClipboardList, CheckCircle2, Clock } from 'lucide-react';

type PerfilExecutor = 'arquiteto';

const perfilLabel: Record<PerfilExecutor, string> = {
  arquiteto: 'Arquiteto',
};

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; cls: string }> = {
    atribuido:    { label: 'Atribuído',    cls: 'bg-blue-500/20 text-blue-400' },
    em_andamento: { label: 'Em Andamento', cls: 'bg-orange-500/20 text-orange-400' },
    concluido:    { label: 'Concluído',    cls: 'bg-success/20 text-success' },
    aberto:       { label: 'Aberto',       cls: 'bg-warning/20 text-warning' },
  };
  const s = map[status] || { label: status, cls: 'bg-muted text-muted-foreground' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>;
};

const AdminArquitetos: React.FC = () => {
  const [executores, setExecutores] = useState<any[]>([]);
  const [chamadosPorExecutor, setChamadosPorExecutor] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '',
    role: 'arquiteto' as PerfilExecutor,

  });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .eq('role', 'arquiteto' as any);

    if (!roles || roles.length === 0) {
      setExecutores([]);
      setLoading(false);
      return;
    }

    const ids = roles.map(r => r.user_id);
    const { data: profiles } = await supabase
      .from('profiles').select('id, full_name, phone').in('id', ids);

    const lista = (profiles || []).map(p => ({
      ...p,
      perfil: roles.find(r => r.user_id === p.id)?.role as PerfilExecutor,
    }));
    setExecutores(lista);

    // Busca chamados atribuídos a cada executor
    const { data: chamados } = await supabase
      .from('chamados')
      .select('id, titulo, local, status, prioridade, data_abertura, atribuido_para')
      .in('atribuido_para', ids)
      .order('data_abertura', { ascending: false });

    const agrupado: Record<string, any[]> = {};
    for (const c of chamados || []) {
      if (!agrupado[c.atribuido_para]) agrupado[c.atribuido_para] = [];
      agrupado[c.atribuido_para].push(c);
    }
    setChamadosPorExecutor(agrupado);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) return;
    setSubmitting(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Sessão expirada. Faça login novamente.');
      setSubmitting(false);
      return;
    }

    const { data, error } = await supabase.functions.invoke('create-user', {
      body: { email: form.email, password: form.password, full_name: form.name, phone: form.phone, role: form.role },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (error || data?.error) {
      toast.error('Erro ao criar perfil', { description: error?.message || data?.error });
    } else {
      toast.success(`${perfilLabel[form.role]} criado com sucesso!`);
      setShowNew(false);
      setForm({ name: '', email: '', phone: '', password: '', role: 'arquiteto' });
      setTimeout(fetchData, 800);
    }
    setSubmitting(false);
  };

  if (loading) {
    return <div className="p-6 lg:p-8"><div className="h-64 bg-card rounded-xl animate-pulse" /></div>;
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Arquitetos</h1>
          <p className="text-sm text-muted-foreground">Profissionais que executam os chamados</p>
        </div>
        <Button variant="golden" onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4 mr-2" /> Novo Perfil
        </Button>
      </div>

      {executores.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">
          Nenhum arquiteto cadastrado.
        </div>
      ) : (
        <div className="space-y-4">
          {executores.map(e => {
            const chamados = chamadosPorExecutor[e.id] || [];
            const ativos    = chamados.filter(c => !['concluido', 'cancelado'].includes(c.status));
            const concluidos = chamados.filter(c => c.status === 'concluido');
            const aberto    = expandido === e.id;

            return (
              <div key={e.id} className="glass-card overflow-hidden">
                {/* Header do executor */}
                <div
                  className="p-5 flex items-center justify-between cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => setExpandido(aberto ? null : e.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-lg font-bold text-primary-foreground shrink-0">
                      {e.full_name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-foreground">{e.full_name}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                          e.perfil === 'arquiteto'
                            ? 'border-secondary/50 text-secondary'
                            : 'border-muted-foreground/50 text-muted-foreground'
                        }`}>
                          {e.perfil === 'arquiteto'
                            ? <><HardHat className="w-3 h-3 inline mr-1" />Arquiteto</>
                            : <><HardHat className="w-3 h-3 inline mr-1" />Arquiteto</>
                          }
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{e.phone || 'Sem telefone'}</p>
                    </div>
                  </div>

                  {/* Stats resumidos */}
                  <div className="flex items-center gap-6 text-center shrink-0">
                    <div>
                      <p className="text-lg font-bold text-orange-400">{ativos.length}</p>
                      <p className="text-xs text-muted-foreground">Ativos</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-success">{concluidos.length}</p>
                      <p className="text-xs text-muted-foreground">Concluídos</p>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {aberto ? '▲' : '▼'}
                    </div>
                  </div>
                </div>

                {/* Chamados expandidos */}
                {aberto && (
                  <div className="border-t border-border px-5 pb-4 pt-3 space-y-2">
                    {chamados.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhum chamado atribuído ainda.
                      </p>
                    ) : (
                      chamados.slice(0, 10).map(c => (
                        <div key={c.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <ClipboardList className="w-4 h-4 text-muted-foreground shrink-0" />
                            <p className="text-sm text-foreground truncate">{c.titulo || c.local}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            <span className="text-xs text-muted-foreground">
                              {new Date(c.data_abertura || '').toLocaleDateString('pt-BR')}
                            </span>
                            {statusBadge(c.status)}
                          </div>
                        </div>
                      ))
                    )}
                    {chamados.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center pt-1">
                        +{chamados.length - 10} chamados não exibidos
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de criação */}
      <Dialog open={showNew} onOpenChange={open => { if (!open && !submitting) setShowNew(false); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Novo Arquiteto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-foreground/80">Tipo de perfil</Label>
              <Select
                value={form.role}
                onValueChange={v => setForm({ ...form, role: v as PerfilExecutor })}
              >
                <SelectTrigger className="bg-muted mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="arquiteto">Arquiteto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-foreground/80">Nome completo</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-muted mt-1" placeholder="Ex: Carlos Silva" />
            </div>
            <div>
              <Label className="text-foreground/80">Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="bg-muted mt-1" placeholder="email@exemplo.com" />
            </div>
            <div>
              <Label className="text-foreground/80">Telefone</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="bg-muted mt-1" placeholder="(11) 99999-9999" />
            </div>
            <div>
              <Label className="text-foreground/80">Senha temporária</Label>
              <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="bg-muted mt-1" placeholder="Mínimo 6 caracteres" />
            </div>
            <Button
              variant="golden" className="w-full" onClick={handleCreate}
              disabled={submitting || !form.name || !form.email || !form.password}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Perfil'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminArquitetos;
