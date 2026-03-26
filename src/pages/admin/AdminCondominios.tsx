import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Loader2, Building2 } from 'lucide-react';

const AdminCondominios: React.FC = () => {
  const [condos, setCondos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', address: '', plano: 'essencial', sindicoEmail: '', sindicoName: '', sindicoPassword: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    const { data } = await supabase.from('condominios').select('*, profiles!condominios_sindico_id_fkey(full_name)');
    setCondos(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async () => {
    if (!form.name || !form.address || !form.sindicoEmail || !form.sindicoPassword) return;
    setSubmitting(true);

    // Create sindico account
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: form.sindicoEmail,
      password: form.sindicoPassword,
      options: { data: { full_name: form.sindicoName, role: 'sindico' } },
    });

    if (authError) { toast.error(authError.message); setSubmitting(false); return; }

    // Wait briefly for trigger
    await new Promise(r => setTimeout(r, 1500));

    const limites: Record<string, number> = { essencial: 5, profissional: 15, premium: 999 };
    const { error } = await supabase.from('condominios').insert({
      name: form.name,
      address: form.address,
      plano: form.plano as any,
      sindico_id: authData.user!.id,
      limite_atendimentos: limites[form.plano],
    });

    if (error) toast.error(error.message);
    else {
      toast.success('Condomínio criado com sucesso!');
      setShowNew(false);
      setForm({ name: '', address: '', plano: 'essencial', sindicoEmail: '', sindicoName: '', sindicoPassword: '' });
      fetchData();
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
        <Button variant="golden" onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4 mr-2" /> Novo Condomínio
        </Button>
      </div>

      {condos.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">Nenhum condomínio cadastrado.</div>
      ) : (
        <div className="space-y-3">
          {condos.map(c => (
            <div key={c.id} className="glass-card p-5 flex items-center justify-between">
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
                <span className="text-sm text-muted-foreground">{c.profiles?.full_name || '—'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">Novo Condomínio</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-foreground/80">Nome</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-muted" /></div>
            <div><Label className="text-foreground/80">Endereço</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="bg-muted" /></div>
            <div>
              <Label className="text-foreground/80">Plano</Label>
              <Select value={form.plano} onValueChange={v => setForm({ ...form, plano: v })}>
                <SelectTrigger className="bg-muted"><SelectValue /></SelectTrigger>
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
                <div><Label className="text-foreground/80">Nome</Label><Input value={form.sindicoName} onChange={e => setForm({ ...form, sindicoName: e.target.value })} className="bg-muted" /></div>
                <div><Label className="text-foreground/80">Email</Label><Input type="email" value={form.sindicoEmail} onChange={e => setForm({ ...form, sindicoEmail: e.target.value })} className="bg-muted" /></div>
                <div><Label className="text-foreground/80">Senha</Label><Input type="password" value={form.sindicoPassword} onChange={e => setForm({ ...form, sindicoPassword: e.target.value })} className="bg-muted" /></div>
              </div>
            </div>
            <Button variant="golden" className="w-full" onClick={handleCreate} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Condomínio'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCondominios;
