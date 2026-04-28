import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { FileText, Loader2 } from 'lucide-react';

type OrcStatus =
  | 'rascunho' | 'enviado' | 'em_analise' | 'aprovado'
  | 'recusado' | 'em_execucao' | 'concluido' | 'cancelado';

interface Orc {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  status: OrcStatus;
  solicitante_id: string;
  prestador_id: string | null;
  condominio_id: string | null;
  valor_proposto: number | null;
  valor_aprovado: number | null;
  prazo_dias: number | null;
  data_solicitacao: string | null;
  observacoes: string | null;
  solicitante?: { full_name: string } | null;
}

const STATUS_CONFIG: Record<OrcStatus, { label: string; cls: string }> = {
  rascunho:    { label: 'Rascunho',    cls: 'bg-muted text-muted-foreground' },
  enviado:     { label: 'Disponível',  cls: 'bg-blue-500/20 text-blue-400' },
  em_analise:  { label: 'Em Análise',  cls: 'bg-warning/20 text-warning' },
  aprovado:    { label: 'Aprovado',    cls: 'bg-success/20 text-success' },
  recusado:    { label: 'Recusado',    cls: 'bg-destructive/20 text-destructive' },
  em_execucao: { label: 'Em Execução', cls: 'bg-purple-500/20 text-purple-400' },
  concluido:   { label: 'Concluído',   cls: 'bg-success/20 text-success' },
  cancelado:   { label: 'Cancelado',   cls: 'bg-muted text-muted-foreground' },
};

const TIPO_EMOJI: Record<string, string> = {
  reparo: '🔧', arquitetura: '🏛️', limpeza: '🧹', seguranca: '🔒', outro: '➕',
  pintura: '🖌️', eletrica: '⚡', hidraulica: '🚿', jardinagem: '🌿',
};

const TABS: { key: string; label: string; match: (o: Orc, myId: string) => boolean }[] = [
  { key: 'disponiveis', label: 'Disponíveis',
    match: (o) => o.status === 'enviado' },
  { key: 'andamento', label: 'Em andamento',
    match: (o, id) => ['em_analise', 'aprovado', 'em_execucao'].includes(o.status) && o.prestador_id === id },
  { key: 'concluidos', label: 'Concluídos',
    match: (o, id) => o.status === 'concluido' && o.prestador_id === id },
  { key: 'recusados', label: 'Recusados',
    match: (o, id) => o.status === 'recusado' && o.prestador_id === id },
];

export default function PrestadorOrcamentos() {
  const { profile } = useAuth();
  const [orcamentos, setOrcamentos] = useState<Orc[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [activeTab, setActiveTab] = useState('disponiveis');

  // Proposta modal
  const [propostaOrc, setPropostaOrc] = useState<Orc | null>(null);
  const [valorProposto, setValorProposto] = useState('');
  const [prazoDias, setPrazoDias] = useState('');
  const [obsProp, setObsProp] = useState('');

  // Progresso modal
  const [progressoOrc, setProgressoOrc] = useState<Orc | null>(null);
  const [obsProgresso, setObsProgresso] = useState('');

  // Detalhes modal
  const [detalhes, setDetalhes] = useState<Orc | null>(null);

  const fetchOrcamentos = useCallback(async () => {
    if (!profile?.id) return;
    const { data, error } = await supabase
      .from('orcamentos')
      .select('*, profiles!orcamentos_solicitante_id_fkey(full_name)')
      .or(`prestador_id.eq.${profile.id},and(status.eq.enviado,prestador_id.is.null)`)
      .order('data_solicitacao', { ascending: false });

    if (error) toast.error('Erro ao carregar orçamentos');
    setOrcamentos((data as any[]) || []);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { fetchOrcamentos(); }, [fetchOrcamentos]);

  const updateStatus = async (orc: Orc, novoStatus: OrcStatus, extra?: Record<string, unknown>) => {
    setActing(true);
    const { error } = await supabase.from('orcamentos')
      .update({ status: novoStatus, ...extra }).eq('id', orc.id);

    if (error) {
      toast.error('Erro ao atualizar orçamento');
      setActing(false);
      return;
    }

    // Auto-create pagamento on approval (handled by solicitante side, but if applicable)
    toast.success(`Status: "${STATUS_CONFIG[novoStatus].label}"`);
    setActing(false);
    fetchOrcamentos();
  };

  const handleAceitar = (orc: Orc) =>
    updateStatus(orc, 'em_analise', { prestador_id: profile!.id });

  const handleEnviarProposta = async () => {
    if (!propostaOrc || !valorProposto || !prazoDias) {
      toast.error('Preencha valor e prazo.');
      return;
    }
    setActing(true);
    const { error } = await supabase.from('orcamentos').update({
      valor_proposto: parseFloat(valorProposto),
      prazo_dias: parseInt(prazoDias),
      observacoes: obsProp || null,
    }).eq('id', propostaOrc.id);

    if (error) {
      toast.error('Erro ao enviar proposta');
    } else {
      toast.success('Proposta enviada ao solicitante');
      setPropostaOrc(null);
      setValorProposto(''); setPrazoDias(''); setObsProp('');
      fetchOrcamentos();
    }
    setActing(false);
  };

  const handleProgresso = async () => {
    if (!progressoOrc) return;
    setActing(true);
    const { error } = await supabase.from('orcamentos')
      .update({ observacoes: obsProgresso || null, status: 'em_execucao' })
      .eq('id', progressoOrc.id);

    if (error) {
      toast.error('Erro ao atualizar progresso');
    } else {
      toast.success('Progresso registrado');
      setProgressoOrc(null);
      setObsProgresso('');
      fetchOrcamentos();
    }
    setActing(false);
  };

  const handleConcluir = (orc: Orc) =>
    updateStatus(orc, 'concluido', { data_conclusao: new Date().toISOString() });

  const handleIniciarExecucao = (orc: Orc) =>
    updateStatus(orc, 'em_execucao');

  const tabData = TABS.map(t => ({
    ...t,
    items: orcamentos.filter(o => t.match(o, profile?.id ?? '')),
  }));

  const currentTab = tabData.find(t => t.key === activeTab) ?? tabData[0];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Orçamentos</h1>
        <p className="text-muted-foreground">Gerencie seus orçamentos e propostas</p>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-muted p-1 gap-1 overflow-x-auto w-fit">
        {tabData.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all relative ${
              activeTab === t.key ? 'gradient-primary text-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
            {t.items.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-secondary/20 text-secondary">
                {t.items.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-28 bg-card rounded-xl animate-pulse" />)}
        </div>
      ) : currentTab.items.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Nenhum orçamento nesta categoria.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {currentTab.items.map(orc => {
            const cfg = STATUS_CONFIG[orc.status];
            return (
              <div key={orc.id} className="glass-card p-5 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl shrink-0">{TIPO_EMOJI[orc.tipo] ?? '📋'}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{orc.titulo}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {(orc as any).profiles?.full_name && `Por ${(orc as any).profiles.full_name} · `}
                        {orc.data_solicitacao ? new Date(orc.data_solicitacao).toLocaleDateString('pt-BR') : '—'}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${cfg.cls}`}>
                    {cfg.label}
                  </span>
                </div>

                {/* Meta */}
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pl-11">
                  {orc.valor_proposto && (
                    <span>Proposta: <span className="text-foreground font-medium">R$ {orc.valor_proposto.toFixed(2)}</span></span>
                  )}
                  {orc.valor_aprovado && (
                    <span>Aprovado: <span className="text-success font-medium">R$ {orc.valor_aprovado.toFixed(2)}</span></span>
                  )}
                  {orc.prazo_dias && (
                    <span>Prazo: <span className="text-foreground font-medium">{orc.prazo_dias}d</span></span>
                  )}
                  {orc.observacoes && (
                    <span className="italic text-muted-foreground line-clamp-1">"{orc.observacoes}"</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-wrap pl-11">
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setDetalhes(orc)}>
                    Detalhes
                  </Button>

                  {/* Disponíveis: Aceitar */}
                  {orc.status === 'enviado' && (
                    <Button variant="golden" size="sm" disabled={acting} onClick={() => handleAceitar(orc)}>
                      Aceitar
                    </Button>
                  )}

                  {/* Em análise: Enviar proposta */}
                  {orc.status === 'em_analise' && orc.prestador_id === profile?.id && (
                    <Button variant="golden" size="sm" disabled={acting} onClick={() => {
                      setPropostaOrc(orc);
                      setValorProposto(orc.valor_proposto?.toString() ?? '');
                      setPrazoDias(orc.prazo_dias?.toString() ?? '');
                      setObsProp(orc.observacoes ?? '');
                    }}>
                      {orc.valor_proposto ? 'Editar Proposta' : 'Enviar Proposta'}
                    </Button>
                  )}

                  {/* Aprovado: Iniciar execução */}
                  {orc.status === 'aprovado' && orc.prestador_id === profile?.id && (
                    <Button variant="golden" size="sm" disabled={acting} onClick={() => handleIniciarExecucao(orc)}>
                      Iniciar Execução
                    </Button>
                  )}

                  {/* Em execução: Atualizar progresso / Concluir */}
                  {orc.status === 'em_execucao' && orc.prestador_id === profile?.id && (
                    <>
                      <Button variant="outline" size="sm" disabled={acting} onClick={() => {
                        setProgressoOrc(orc);
                        setObsProgresso(orc.observacoes ?? '');
                      }}>
                        Atualizar Progresso
                      </Button>
                      <Button variant="golden" size="sm" disabled={acting} onClick={() => handleConcluir(orc)}>
                        Concluir
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Detalhes */}
      <Dialog open={!!detalhes} onOpenChange={() => setDetalhes(null)}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">{detalhes?.titulo}</DialogTitle>
          </DialogHeader>
          {detalhes && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Status</span>
                  <p><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CONFIG[detalhes.status].cls}`}>{STATUS_CONFIG[detalhes.status].label}</span></p>
                </div>
                <div><span className="text-muted-foreground">Solicitante</span>
                  <p className="text-foreground font-medium">{(detalhes as any).profiles?.full_name ?? '—'}</p>
                </div>
                {detalhes.valor_proposto && <div><span className="text-muted-foreground">Proposta</span><p className="text-foreground font-medium">R$ {detalhes.valor_proposto.toFixed(2)}</p></div>}
                {detalhes.valor_aprovado && <div><span className="text-muted-foreground">Aprovado</span><p className="text-success font-medium">R$ {detalhes.valor_aprovado.toFixed(2)}</p></div>}
                {detalhes.prazo_dias && <div><span className="text-muted-foreground">Prazo</span><p className="text-foreground font-medium">{detalhes.prazo_dias} dias</p></div>}
                <div><span className="text-muted-foreground">Solicitado em</span><p className="text-foreground font-medium">{detalhes.data_solicitacao ? new Date(detalhes.data_solicitacao).toLocaleDateString('pt-BR') : '—'}</p></div>
              </div>
              {detalhes.descricao && (
                <div className="pt-2 border-t border-border">
                  <p className="text-muted-foreground mb-1">Descrição</p>
                  <p className="text-foreground">{detalhes.descricao}</p>
                </div>
              )}
              {detalhes.observacoes && (
                <div className="pt-2 border-t border-border">
                  <p className="text-muted-foreground mb-1">Observações</p>
                  <p className="text-foreground italic">"{detalhes.observacoes}"</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Proposta */}
      <Dialog open={!!propostaOrc} onOpenChange={open => { if (!open) { setPropostaOrc(null); setValorProposto(''); setPrazoDias(''); setObsProp(''); } }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">Enviar Proposta</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-foreground/80">Valor (R$)</Label>
              <Input type="number" value={valorProposto} onChange={e => setValorProposto(e.target.value)} placeholder="0,00" className="bg-muted mt-1" />
            </div>
            <div>
              <Label className="text-foreground/80">Prazo estimado (dias)</Label>
              <Input type="number" value={prazoDias} onChange={e => setPrazoDias(e.target.value)} placeholder="Ex: 7" className="bg-muted mt-1" />
            </div>
            <div>
              <Label className="text-foreground/80">Observações (opcional)</Label>
              <Textarea value={obsProp} onChange={e => setObsProp(e.target.value)} placeholder="Detalhes da proposta..." className="bg-muted mt-1 resize-none" rows={3} />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setPropostaOrc(null)}>Cancelar</Button>
            <Button variant="golden" disabled={acting} onClick={handleEnviarProposta}>
              {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Progresso */}
      <Dialog open={!!progressoOrc} onOpenChange={open => { if (!open) { setProgressoOrc(null); setObsProgresso(''); } }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">Atualizar Progresso</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-foreground/80">Observação</Label>
              <Textarea value={obsProgresso} onChange={e => setObsProgresso(e.target.value)} placeholder="Descreva o progresso do serviço..." className="bg-muted mt-1 resize-none" rows={4} />
            </div>
            <p className="text-xs text-muted-foreground">Upload de foto disponível em breve.</p>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setProgressoOrc(null)}>Cancelar</Button>
            <Button variant="golden" disabled={acting} onClick={handleProgresso}>
              {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
