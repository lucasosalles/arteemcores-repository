import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Loader2, Wrench } from 'lucide-react';

const AdminTecnicos: React.FC = () => {
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    const { data: roles } = await supabase.from('user_roles').select('user_id').in('role', ['prestador', 'tecnico']);
    if (roles && roles.length > 0) {
      const ids = roles.map(r => r.user_id);
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', ids);
      setTecnicos(profiles || []);
    } else {
      setTecnicos([]);
    }
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
      toast.error('Erro ao criar técnico', { description: error?.message || data?.error });
    } else {
      toast.success('Técnico criado com sucesso!');
      setShowNew(false);
      setForm({ name: '', email: '', phone: '', password: '' });
      setTimeout(fetchData, 800);
    }
    setSubmitting(false);
  };

  if (loading) return <div className="p-6 lg:p-8"><div className="h-64 bg-card rounded-xl animate-pulse" /></div>;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Gestão de Técnicos</h1>
        <Button variant="golden" onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4 mr-2" /> Novo Técnico
        </Button>
      </div>

      {tecnicos.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">Nenhum técnico cadastrado.</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tecnicos.map(t => (
            <div key={t.id} className="glass-card p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-lg font-bold text-primary-foreground">
                  {t.full_name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-foreground">{t.full_name}</p>
                  <p className="text-xs text-muted-foreground">{t.phone || 'Sem telefone'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Técnico</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showNew} onOpenChange={open => { if (!open && !submitting) setShowNew(false); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">Novo Técnico</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-foreground/80">Nome completo</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="bg-muted mt-1" /></div>
            <div><Label className="text-foreground/80">Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="bg-muted mt-1" /></div>
            <div><Label className="text-foreground/80">Telefone</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="bg-muted mt-1" /></div>
            <div><Label className="text-foreground/80">Senha temporária</Label><Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="bg-muted mt-1" /></div>
            <Button variant="golden" className="w-full" onClick={handleCreate} disabled={submitting || !form.name || !form.email || !form.password}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Técnico'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTecnicos;
