import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Loader2, Building2, Users, UserPlus, ChevronDown, ChevronUp } from 'lucide-react';

interface Morador {
  id: string;
  full_name: string;
  phone: string | null;
}

interface Condominio {
  id: string;
  name: string;
  address: string;
  plano: string;
  ativo: boolean;
  profiles?: { full_name: string } | null;
  moradores?: Morador[];
}

const AdminCondominios: React.FC = () => {
  const [condos, setCondos] = useState<Condominio[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [showNewCondo, setShowNewCondo] = useState(false);
  const [showNewMorador, setShowNewMorador] = useState<string | null>(null); // condominio_id
  const [condoForm, setCondoForm] = useState({ name: '', address: '', plano: 'essencial', sindicoEmail: '', sindicoName: '', sindicoPassword: '' });
  const [moradorForm, setMoradorForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const { data: condosData } = await supabase
        .from('condominios')
        .select('*, profiles!condominios_sindico_id_fkey(full_name)')
        .order('created_at', { ascending: false });

      if (!condosData) { setLoading(false); return; }

      // Busca moradores de todos os condominios
      const ids = condosData.map(c => c.id);
      const { data: moradoresData } = await supabase
        .from('profiles')
        .select('id, full_name, phone, condominio_id')
        .in('condominio_id', ids);

      const condosComMoradores = condosData.map(c => ({
        ...c,
        moradores: (moradoresData || []).filter(m => m.condominio_id === c.id),
      }));

      setCondos(condosComMoradores);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreateCondo = async () => {
    if (!condoForm.name || !condoForm.address || !condoForm.sindicoEmail) return;
    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Sessão expirada.'); setSubmitting(false); return; }

      let sindicoId: string | null = null;
      const { data: existingId } = await supabase
        .rpc('get_user_id_by_email', { p_email: condoForm.sindicoEmail });
      sindicoId = existingId ?? null;

      if (!sindicoId) {
        if (!condoForm.sindicoPassword) {
          toast.error('Informe uma senha para o síndico.');
          setSubmitting(false);
          return;
        }
        const { data, error } = await supabase.functions.invoke('create-user', {
          body: { email: condoForm.sindicoEmail, password: condoForm.sindicoPassword, full_name: condoForm.sindicoName || condoForm.sindicoEmail, phone: '', role: 'sindico' },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (error || data?.error) {
          toast.error('Erro ao criar síndico', { description: error?.message || data?.error });
          setSubmitting(false);
          return;
        }
        sindicoId = data.user?.id;
      }

      if (!sindicoId) { toast.error('Não foi possível obter o ID do síndico.'); setSubmitting(false); return; }

      const limites: Record<string, number> = { essencial: 5, profissional: 15, premium: 999 };
      const { error } = await supabase.from('condominios').insert({
        name: condoForm.name,
        address: condoForm.address,
        plano: condoForm.plano as any,
        sindico_id: sindicoId,
        limite_atendimentos: limites[condoForm.plano],
        atendimentos_mes: 0,
        ativo: true,
      });

      if (error) {
        toast.error('Erro ao criar condomínio: ' + error.message);
      } else {
        toast.success('Condomínio criado com sucesso!');
        setShowNewCondo(false);
        setCondoForm({ name: '', address: '', plano: 'essencial', sindicoEmail: '', sindicoName: '', sindicoPassword: '' });
        fetchData();
      }
    } catch (err: any) {
      toast.error('Erro inesperado: ' + err.message);
    }
    setSubmitting(false);
  };

  const handleCreateMorador = async (condominioId: string) => {
    if (!moradorForm.name || !moradorForm.email || !moradorForm.password) return;
    setSubmitting(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error('Sessão expirada.'); setSubmitting(false); return; }

    const { data, error } = await supabase.functions.invoke('create-user', {
      body: {
        email: moradorForm.email,
        password: moradorForm.password,
        full_name: moradorForm.name,
        phone: moradorForm.phone,
        role: 'morador',
        condominio_id: condominioId,
      },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (error || data?.error) {
      toast.error('Erro ao criar morador', { description: error?.message || data?.error });
    } else {
      toast.success('Morador criado com sucesso!');
      setShowNewMorador(null);
      setMoradorForm({ name: '', email: '', phone: '', password: '' });
      setTimeout(fetchData, 800);
    }
    setSubmitting(false);
  };

  const planoBadge = (plano: string) => {
    const cls: Record<string, string> = {
      essencial: 'bg-muted text-muted-foreground',
      profissional: 'bg-info/20 text-info',
      premium: 'bg-secondary/20 text-secondary',
    };
    return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${cls[plano] || ''}`}>{plano}</span>;
  };

  if (loading) return <div className="p-6 lg:p-8"><div className="h-64 bg-card rounded-xl animate-pulse" /></div>;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Gestão de Condomínios</h1>
        <Button variant="golden" onClick={() => setShowNewCondo(true)}>
          <Plus className="w-4 h-4 mr-2" /> Novo Condomínio
        </Button>
      </div>

      {condos.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">Nenhum condomínio cadastrado.</div>
      ) : (
        <div className="space-y-3">
          {condos.map(c => {
            const aberto = expandido === c.id;
            const moradores = c.moradores || [];
            return (
              <div key={c.id} className="glass-card overflow-hidden">
                {/* Header */}
                <div
                  className="p-5 flex items-center justify-between cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => setExpandido(aberto ? null : c.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/30 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.address}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {planoBadge(c.plano)}
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span>{moradores.length}</span>
                    </div>
                    <span className="text-sm text-muted-foreground hidden sm:block">{(c.profiles as any)?.full_name || '—'}</span>
                    {aberto ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>

                {/* Moradores expandidos */}
                {aberto && (
                  <div className="border-t border-border px-5 pb-4 pt-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">
                        Moradores ({moradores.length})
                      </p>
                      <Button variant="golden" size="sm" onClick={() => setShowNewMorador(c.id)}>
                        <UserPlus className="w-4 h-4 mr-1" /> Adicionar Morador
                      </Button>
                    </div>

                    {moradores.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">Nenhum morador cadastrado.</p>
                    ) : (
                      <div className="space-y-2">
                        {moradores.map(m => (
                          <div key={m.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                            <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center text-sm font-bold text-primary-foreground">
                              {m.full_name?.charAt(0)?.toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{m.full_name}</p>
                              <p className="text-xs text-muted-foreground">{m.phone || 'Sem telefone'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Novo Condomínio */}
      <Dialog open={showNewCondo} onOpenChange={setShowNewCondo}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">Novo Condomínio</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-foreground/80">Nome</Label><Input value={condoForm.name} onChange={e => setCondoForm({ ...condoForm, name: e.target.value })} className="bg-muted mt-1" /></div>
            <div><Label className="text-foreground/80">Endereço</Label><Input value={condoForm.address} onChange={e => setCondoForm({ ...condoForm, address: e.target.value })} className="bg-muted mt-1" /></div>
            <div>
              <Label className="text-foreground/80">Plano</Label>
              <Select value={condoForm.plano} onValueChange={v => setCondoForm({ ...condoForm, plano: v })}>
                <SelectTrigger className="bg-muted mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="essencial">Essencial — R$ 490/mês</SelectItem>
                  <SelectItem value="profissional">Profissional — R$ 890/mês</SelectItem>
                  <SelectItem value="premium">Premium — R$ 1.490/mês</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="border-t border-border pt-4">
              <p className="text-sm font-semibold text-foreground mb-3">Dados do Síndico</p>
              <div className="space-y-3">
                <div><Label className="text-foreground/80">Nome</Label><Input value={condoForm.sindicoName} onChange={e => setCondoForm({ ...condoForm, sindicoName: e.target.value })} className="bg-muted mt-1" /></div>
                <div><Label className="text-foreground/80">Email</Label><Input type="email" value={condoForm.sindicoEmail} onChange={e => setCondoForm({ ...condoForm, sindicoEmail: e.target.value })} className="bg-muted mt-1" /></div>
                <div><Label className="text-foreground/80">Senha</Label><Input type="password" value={condoForm.sindicoPassword} onChange={e => setCondoForm({ ...condoForm, sindicoPassword: e.target.value })} className="bg-muted mt-1" /></div>
              </div>
            </div>
            <Button variant="golden" className="w-full" onClick={handleCreateCondo} disabled={submitting || !condoForm.name || !condoForm.address || !condoForm.sindicoEmail}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Condomínio'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Novo Morador */}
      <Dialog open={!!showNewMorador} onOpenChange={open => { if (!open) setShowNewMorador(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">Adicionar Morador</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-foreground/80">Nome completo</Label><Input value={moradorForm.name} onChange={e => setMoradorForm({ ...moradorForm, name: e.target.value })} className="bg-muted mt-1" /></div>
            <div><Label className="text-foreground/80">Email</Label><Input type="email" value={moradorForm.email} onChange={e => setMoradorForm({ ...moradorForm, email: e.target.value })} className="bg-muted mt-1" /></div>
            <div><Label className="text-foreground/80">Telefone</Label><Input value={moradorForm.phone} onChange={e => setMoradorForm({ ...moradorForm, phone: e.target.value })} className="bg-muted mt-1" /></div>
            <div><Label className="text-foreground/80">Senha temporária</Label><Input type="password" value={moradorForm.password} onChange={e => setMoradorForm({ ...moradorForm, password: e.target.value })} className="bg-muted mt-1" /></div>
            <Button
              variant="golden" className="w-full"
              onClick={() => showNewMorador && handleCreateMorador(showNewMorador)}
              disabled={submitting || !moradorForm.name || !moradorForm.email || !moradorForm.password}
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Adicionar Morador'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCondominios;
