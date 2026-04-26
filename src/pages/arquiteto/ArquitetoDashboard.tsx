import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { mudarStatusChamado, statusDisponiveis, type ChamadoStatus } from '@/lib/chamadoFlow';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const prioridadeOrder: Record<string, number> = {
  alta: 0, urgente: 0, media: 1, normal: 1, baixa: 2,
};

const tipoLabel: Record<string, string> = {
  reparo: '🔧 Reparo', arquitetura: '🏛️ Arquitetura', limpeza: '🧹 Limpeza',
  seguranca: '🔒 Segurança', outro: '➕ Outro',
  pintura_interna: '🖌️ Pintura Interna', pintura_fachada: '🏗️ Pintura Fachada',
  esquadria: '🪟 Esquadria', teto: '🛖 Teto', urgencia: '⚡ Urgência', outros: '➕ Outros',
};

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; cls: string }> = {
    aberto:       { label: 'Aberto',       cls: 'bg-warning/20 text-warning' },
    atribuido:    { label: 'Atribuído',    cls: 'bg-blue-500/20 text-blue-400' },
    em_andamento: { label: 'Em Andamento', cls: 'bg-orange-500/20 text-orange-400' },
    concluido:    { label: 'Concluído',    cls: 'bg-success/20 text-success' },
    cancelado:    { label: 'Cancelado',    cls: 'bg-muted text-muted-foreground' },
    aguardando:   { label: 'Aguardando',   cls: 'bg-warning/20 text-warning' },
    aceito:       { label: 'Aceito',       cls: 'bg-blue-500/20 text-blue-400' },
    a_caminho:    { label: 'A Caminho',    cls: 'bg-blue-500/20 text-blue-400' },
  };
  const s = map[status] || { label: status, cls: 'bg-muted text-muted-foreground' };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>;
};

const prioridadeBadge = (prioridade: string) => {
  const map: Record<string, { label: string; cls: string }> = {
    baixa:   { label: 'Baixa',   cls: 'bg-muted text-muted-foreground' },
    media:   { label: 'Média',   cls: 'bg-warning/20 text-warning' },
    alta:    { label: 'Alta',    cls: 'bg-destructive/20 text-destructive' },
    normal:  { label: 'Normal',  cls: 'bg-muted text-muted-foreground' },
    urgente: { label: 'Urgente', cls: 'bg-destructive/20 text-destructive' },
  };
  const p = map[prioridade] || { label: prioridade, cls: 'bg-muted text-muted-foreground' };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${p.cls}`}>{p.label}</span>;
};

const ArquitetoDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [chamados, setChamados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [novoStatus, setNovoStatus] = useState('');
  const [observacao, setObservacao] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('chamados')
      .select('*, condominios(name)')
      .eq('atribuido_para', profile.id)
      .order('data_abertura', { ascending: true });

    if (data) {
      const sorted = [...data].sort((a, b) => {
        const pa = prioridadeOrder[a.prioridade] ?? 1;
        const pb = prioridadeOrder[b.prioridade] ?? 1;
        return pa - pb;
      });
      setChamados(sorted);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [profile?.id]);

  const stats = {
    atribuidos:   chamados.filter(c => c.status === 'atribuido').length,
    em_andamento: chamados.filter(c => c.status === 'em_andamento').length,
    concluidos:   chamados.filter(c => c.status === 'concluido').length,
  };

  const handleUpdate = async () => {
    if (!selected || !novoStatus || !observacao.trim()) {
      toast.error('Preencha o novo status e a observação.');
      return;
    }
    setSubmitting(true);

    const result = await mudarStatusChamado({
      chamadoId: selected.id,
      statusAtual: selected.status,
      statusNovo: novoStatus as ChamadoStatus,
      usuarioId: profile!.id,
      perfil: 'arquiteto',
      observacao: observacao.trim(),
    });

    if (!result.ok) {
      toast.error('Erro ao atualizar chamado', { description: result.erro });
      setSubmitting(false);
      return;
    }

    toast.success('Status atualizado!');
    setSelected(null);
    setNovoStatus('');
    setObservacao('');
    fetchData();
    setSubmitting(false);
  };

  const ativos = chamados.filter(c => !['concluido', 'cancelado'].includes(c.status));

  if (loading) return <div className="p-6"><div className="h-64 bg-card rounded-xl animate-pulse" /></div>;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Olá, {profile?.full_name?.split(' ')[0]} 👋</h1>
        <p className="text-muted-foreground">Seus chamados atribuídos</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Atribuídos',   value: stats.atribuidos,   cls: 'text-blue-400' },
          { label: 'Em Andamento', value: stats.em_andamento, cls: 'text-orange-400' },
          { label: 'Concluídos',   value: stats.concluidos,   cls: 'text-success' },
        ].map(s => (
          <div key={s.label} className="glass-card p-4 text-center">
            <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Lista de ativos */}
      {ativos.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">
          Nenhum chamado ativo atribuído a você.
        </div>
      ) : (
        <div className="space-y-3">
          {ativos.map(c => (
            <div key={c.id} className="glass-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-lg shrink-0">{tipoLabel[c.tipo]?.split(' ')[0] || '📋'}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{c.titulo || c.local}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.condominios?.name}{c.local ? ` · ${c.local}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {prioridadeBadge(c.prioridade)}
                  {statusBadge(c.status)}
                </div>
              </div>
              {c.descricao && (
                <p className="text-sm text-muted-foreground line-clamp-2">{c.descricao}</p>
              )}
              {['atribuido', 'em_andamento', 'aceito', 'a_caminho'].includes(c.status) && (
                <Button variant="golden" size="sm" className="w-full"
                  onClick={() => { setSelected(c); setNovoStatus(''); setObservacao(''); }}>
                  Atualizar Status
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal de atualização */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Atualizar Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Chamado: <span className="text-foreground font-medium">{selected?.titulo || selected?.local}</span>
            </p>
            <div>
              <Label className="text-foreground/80">Novo Status</Label>
              <Select value={novoStatus} onValueChange={setNovoStatus}>
                <SelectTrigger className="bg-muted mt-1">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {statusDisponiveis('arquiteto', selected?.status ?? '').map(s => (
                    <SelectItem key={s} value={s}>
                      {s === 'em_andamento' ? 'Em Andamento' : s === 'concluido' ? 'Concluído' : s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-foreground/80">
                Observação <span className="text-destructive">*</span>
              </Label>
              <Textarea value={observacao} onChange={e => setObservacao(e.target.value)}
                placeholder="Descreva o que foi feito ou o andamento do serviço..."
                className="bg-muted min-h-[100px] mt-1" />
            </div>
            <Button variant="golden" className="w-full" onClick={handleUpdate}
              disabled={submitting || !novoStatus || !observacao.trim()}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ArquitetoDashboard;
