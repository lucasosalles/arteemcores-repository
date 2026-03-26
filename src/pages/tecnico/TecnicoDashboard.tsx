import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { CheckCircle2, MapPin, ArrowRight, Wrench, Camera, Loader2 } from 'lucide-react';

const TecnicoDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [available, setAvailable] = useState<any[]>([]);
  const [activeChamado, setActiveChamado] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showFinish, setShowFinish] = useState(false);
  const [obs, setObs] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    if (!profile?.id) return;
    const [availRes, activeRes] = await Promise.all([
      supabase.from('chamados').select('*, condominios(name)').eq('status', 'aguardando').order('prioridade'),
      supabase.from('chamados').select('*, condominios(name)')
        .eq('tecnico_id', profile.id)
        .in('status', ['aceito', 'a_caminho', 'em_andamento'])
        .single(),
    ]);
    setAvailable(availRes.data || []);
    setActiveChamado(activeRes.data || null);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [profile?.id]);

  const acceptChamado = async (id: string) => {
    const { error } = await supabase.from('chamados').update({ tecnico_id: profile!.id, status: 'aceito' as any }).eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Chamado aceito!'); fetchData(); }
  };

  const advanceStatus = async () => {
    if (!activeChamado) return;
    const nextStatus: Record<string, string> = { aceito: 'a_caminho', a_caminho: 'em_andamento' };
    const next = nextStatus[activeChamado.status];
    if (!next) return;
    const { error } = await supabase.from('chamados').update({ status: next as any }).eq('id', activeChamado.id);
    if (error) toast.error(error.message);
    else { toast.success('Status atualizado!'); fetchData(); }
  };

  const finishChamado = async () => {
    if (!activeChamado) return;
    setSubmitting(true);
    const { error } = await supabase.from('chamados').update({
      status: 'concluido' as any,
      observacoes_tecnico: obs,
      concluded_at: new Date().toISOString(),
    }).eq('id', activeChamado.id);
    if (error) toast.error(error.message);
    else { toast.success('Serviço finalizado!'); setShowFinish(false); setObs(''); fetchData(); }
    setSubmitting(false);
  };

  const tipoLabel: Record<string, string> = {
    pintura_interna: '🖌️ Pintura Interna', pintura_fachada: '🏗️ Pintura Fachada',
    esquadria: '🪟 Esquadria', teto: '🛖 Teto', urgencia: '⚡ Urgência', outros: '➕ Outros',
  };

  const actionLabel: Record<string, { text: string; icon: React.ReactNode }> = {
    aceito: { text: 'Confirmar Saída', icon: <ArrowRight className="w-4 h-4" /> },
    a_caminho: { text: 'Cheguei ao Local', icon: <MapPin className="w-4 h-4" /> },
    em_andamento: { text: 'Finalizar Serviço', icon: <CheckCircle2 className="w-4 h-4" /> },
  };

  if (loading) return <div className="p-6 lg:p-8"><div className="h-64 bg-card rounded-xl animate-pulse" /></div>;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Olá, {profile?.full_name?.split(' ')[0]} 👋</h1>

      {/* Active chamado */}
      {activeChamado && (
        <div className="glass-card p-6 ring-2 ring-secondary glow-secondary space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground">Chamado Ativo</h3>
            <span className="px-3 py-1 rounded-full text-xs font-bold gradient-gold text-secondary-foreground">
              #{String(activeChamado.numero).padStart(4, '0')}
            </span>
          </div>
          <div className="space-y-2">
            <p className="text-sm text-foreground">{tipoLabel[activeChamado.tipo]}</p>
            <p className="text-sm text-muted-foreground">{activeChamado.condominios?.name} — {activeChamado.local}</p>
            <p className="text-sm text-muted-foreground">{activeChamado.descricao}</p>
          </div>
          <Button
            variant={activeChamado.status === 'em_andamento' ? 'golden' : 'success'}
            className="w-full"
            onClick={() => activeChamado.status === 'em_andamento' ? setShowFinish(true) : advanceStatus()}
          >
            {actionLabel[activeChamado.status]?.icon}
            <span className="ml-2">{actionLabel[activeChamado.status]?.text}</span>
          </Button>
        </div>
      )}

      {/* Available chamados */}
      <div>
        <h2 className="text-lg font-bold text-foreground mb-4">Chamados Disponíveis ({available.length})</h2>
        {available.length === 0 ? (
          <div className="glass-card p-12 text-center text-muted-foreground">Nenhum chamado disponível no momento.</div>
        ) : (
          <div className="space-y-3">
            {available.map(c => (
              <div key={c.id} className="glass-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{tipoLabel[c.tipo]?.split(' ')[0]}</span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{c.condominios?.name} — {c.local}</p>
                      <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  {c.prioridade !== 'normal' && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                      c.prioridade === 'urgente' ? 'border-destructive text-destructive' : 'border-warning text-warning'
                    }`}>{c.prioridade === 'urgente' ? 'Urgente' : 'Alta'}</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{c.descricao}</p>
                <div className="flex gap-2">
                  <Button variant="success" size="sm" className="flex-1" onClick={() => acceptChamado(c.id)} disabled={!!activeChamado}>
                    Aceitar
                  </Button>
                  <Button variant="ghost" size="sm" className="text-muted-foreground">Recusar</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Finish modal */}
      <Dialog open={showFinish} onOpenChange={setShowFinish}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">Finalizar Serviço</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-foreground/80">Observações</label>
              <Textarea value={obs} onChange={e => setObs(e.target.value)} placeholder="Descreva o serviço realizado..." className="bg-muted min-h-[100px]" />
            </div>
            <Button variant="golden" className="w-full" onClick={finishChamado} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Conclusão'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TecnicoDashboard;
