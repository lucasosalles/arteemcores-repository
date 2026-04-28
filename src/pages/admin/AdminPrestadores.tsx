import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Loader2, CheckCircle2, XCircle } from 'lucide-react';

const ESPECIALIDADE_LABEL: Record<string, string> = {
  reparo: 'Reparo', arquitetura: 'Arquitetura', limpeza: 'Limpeza',
  seguranca: 'Segurança', pintura: 'Pintura', eletrica: 'Elétrica',
  hidraulica: 'Hidráulica', jardinagem: 'Jardinagem', outro: 'Outro',
};

const TODAS_ESPECIALIDADES = Object.keys(ESPECIALIDADE_LABEL);

interface Prestador {
  id: string;
  full_name: string;
  phone: string | null;
  disponivel: boolean | null;
  especialidades: string[] | null;
  condo_name: string | null;
  disp_id: string | null;
}

const AdminPrestadores: React.FC = () => {
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [filtroDisp, setFiltroDisp] = useState<'todos' | 'disponivel' | 'indisponivel'>('todos');
  const [filtroEsp, setFiltroEsp] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchData = async () => {
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['prestador', 'tecnico']);

    if (!roles || roles.length === 0) { setLoading(false); setPrestadores([]); return; }

    const ids = roles.map(r => r.user_id);

    const [profilesRes, dispRes, chamadosRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, phone').in('id', ids),
      supabase.from('disponibilidade_prestador').select('id, prestador_id, disponivel, especialidades').in('prestador_id', ids),
      supabase.from('chamados').select('atribuido_para, condominio_id, condominios(name)').in('atribuido_para', ids).order('created_at', { ascending: false }),
    ]);

    const dispMap = new Map((dispRes.data || []).map((d: any) => [d.prestador_id, d]));

    // Pega o primeiro condomínio encontrado por prestador
    const condoMap = new Map<string, string>();
    for (const c of (chamadosRes.data || []) as any[]) {
      if (c.atribuido_para && !condoMap.has(c.atribuido_para) && c.condominios?.name) {
        condoMap.set(c.atribuido_para, c.condominios.name);
      }
    }

    const lista: Prestador[] = (profilesRes.data || []).map((p: any) => {
      const disp = dispMap.get(p.id);
      return {
        id: p.id,
        full_name: p.full_name,
        phone: p.phone,
        disponivel: disp?.disponivel ?? null,
        especialidades: disp?.especialidades ?? null,
        condo_name: condoMap.get(p.id) ?? null,
        disp_id: disp?.id ?? null,
      };
    });

    lista.sort((a, b) => {
      if (a.disponivel === b.disponivel) return 0;
      return a.disponivel === true ? -1 : 1;
    });

    setPrestadores(lista);
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
      body: { email: form.email, password: form.password, full_name: form.name, phone: form.phone, role: 'prestador' },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (error || data?.error) {
      toast.error('Erro ao criar prestador', { description: error?.message || data?.error });
    } else {
      toast.success('Prestador criado com sucesso!');
      setShowNew(false);
      setForm({ name: '', email: '', phone: '', password: '' });
      setTimeout(fetchData, 800);
    }
    setSubmitting(false);
  };

  const handleToggle = async (p: Prestador) => {
    setToggling(p.id);
    const novoDisp = !p.disponivel;

    if (p.disp_id) {
      const { error } = await supabase
        .from('disponibilidade_prestador')
        .update({ disponivel: novoDisp })
        .eq('id', p.disp_id);
      if (error) { toast.error(error.message); setToggling(null); return; }
    } else {
      const { error } = await supabase
        .from('disponibilidade_prestador')
        .insert({ prestador_id: p.id, disponivel: novoDisp, especialidades: [], tempo_medio_execucao_dias: null, observacao: null });
      if (error) { toast.error(error.message); setToggling(null); return; }
    }

    toast.success(`Prestador ${novoDisp ? 'ativado' : 'desativado'}.`);
    setToggling(null);
    fetchData();
  };

  const filtered = prestadores.filter(p => {
    if (filtroDisp === 'disponivel' && p.disponivel !== true) return false;
    if (filtroDisp === 'indisponivel' && p.disponivel === true) return false;
    if (filtroEsp && !(p.especialidades ?? []).includes(filtroEsp)) return false;
    return true;
  });

  if (loading) return <div className="p-6 lg:p-8"><div className="h-64 bg-card rounded-xl animate-pulse" /></div>;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Gestão de Prestadores</h1>
        <Button variant="golden" onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4 mr-2" /> Novo Prestador
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="flex rounded-xl bg-muted p-1 gap-1">
          {([['todos', 'Todos'], ['disponivel', 'Disponíveis'], ['indisponivel', 'Indisponíveis']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFiltroDisp(val)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                filtroDisp === val ? 'gradient-primary text-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          value={filtroEsp}
          onChange={e => setFiltroEsp(e.target.value)}
          className="px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground"
        >
          <option value="">Todas as especialidades</option>
          {TODAS_ESPECIALIDADES.map(e => (
            <option key={e} value={e}>{ESPECIALIDADE_LABEL[e]}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">
          Nenhum prestador encontrado.
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-4 text-muted-foreground font-medium">Nome</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Contato</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Especialidades</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Disponibilidade</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Condomínio</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground shrink-0">
                          {p.full_name?.charAt(0)?.toUpperCase()}
                        </div>
                        <span className="font-semibold text-foreground">{p.full_name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-muted-foreground">{p.phone || '—'}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {(p.especialidades ?? []).length > 0
                          ? p.especialidades!.map(e => (
                              <span key={e} className="px-2 py-0.5 rounded-full text-xs bg-secondary/10 text-secondary border border-secondary/20">
                                {ESPECIALIDADE_LABEL[e] ?? e}
                              </span>
                            ))
                          : <span className="text-muted-foreground">—</span>
                        }
                      </div>
                    </td>
                    <td className="p-4">
                      {p.disponivel === null ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground">Sem info</span>
                      ) : p.disponivel ? (
                        <span className="flex items-center gap-1 w-fit px-2.5 py-1 rounded-full text-xs font-semibold bg-success/20 text-success">
                          <CheckCircle2 className="w-3 h-3" /> Disponível
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 w-fit px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
                          <XCircle className="w-3 h-3" /> Indisponível
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-muted-foreground">{p.condo_name ?? '—'}</td>
                    <td className="p-4">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={toggling === p.id}
                        onClick={() => handleToggle(p)}
                        className="text-xs"
                      >
                        {toggling === p.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : p.disponivel ? 'Desativar' : 'Ativar'
                        }
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Novo Prestador */}
      <Dialog open={showNew} onOpenChange={open => { if (!open && !submitting) setShowNew(false); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">Novo Prestador</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-foreground/80">Nome completo</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-muted mt-1" />
            </div>
            <div>
              <Label className="text-foreground/80">Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="bg-muted mt-1" />
            </div>
            <div>
              <Label className="text-foreground/80">Telefone</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="bg-muted mt-1" />
            </div>
            <div>
              <Label className="text-foreground/80">Senha temporária</Label>
              <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="bg-muted mt-1" />
            </div>
            <Button
              variant="golden"
              className="w-full"
              onClick={handleCreate}
              disabled={submitting || !form.name || !form.email || !form.password}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Prestador'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPrestadores;
