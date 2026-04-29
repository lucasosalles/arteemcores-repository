import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, FileText, Loader2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

type OrcStatus = 'rascunho' | 'enviado' | 'em_analise' | 'aprovado' | 'recusado' | 'em_execucao' | 'concluido' | 'cancelado';

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
  prestador?: { full_name: string } | null;
  condominios?: { name: string } | null;
}

const STATUS_CONFIG: Record<OrcStatus, { label: string; cls: string }> = {
  rascunho:    { label: 'Rascunho',    cls: 'bg-muted text-muted-foreground' },
  enviado:     { label: 'Enviado',     cls: 'bg-blue-500/20 text-blue-400' },
  em_analise:  { label: 'Em Análise',  cls: 'bg-warning/20 text-warning' },
  aprovado:    { label: 'Aprovado',    cls: 'bg-success/20 text-success' },
  recusado:    { label: 'Recusado',    cls: 'bg-destructive/20 text-destructive' },
  em_execucao: { label: 'Em Execução', cls: 'bg-purple-500/20 text-purple-400' },
  concluido:   { label: 'Concluído',   cls: 'bg-success/20 text-success' },
  cancelado:   { label: 'Cancelado',   cls: 'bg-muted text-muted-foreground' },
};

const TIPO_OPTIONS = [
  { value: 'reparo', label: 'Reparo', icon: '🔧' },
  { value: 'arquitetura', label: 'Arquitetura', icon: '🏛️' },
  { value: 'limpeza', label: 'Limpeza', icon: '🧹' },
  { value: 'seguranca', label: 'Segurança', icon: '🔒' },
  { value: 'pintura', label: 'Pintura', icon: '🖌️' },
  { value: 'eletrica', label: 'Elétrica', icon: '⚡' },
  { value: 'hidraulica', label: 'Hidráulica', icon: '🚿' },
  { value: 'outro', label: 'Outro', icon: '➕' },
];

const TIPO_EMOJI: Record<string, string> = {
  reparo: '🔧', arquitetura: '🏛️', limpeza: '🧹', seguranca: '🔒',
  pintura: '🖌️', eletrica: '⚡', hidraulica: '🚿', outro: '➕',
};

const TABS = [
  { key: 'pendentes', label: 'Pendentes', match: (o: Orc) => o.status === 'em_analise' },
  { key: 'andamento', label: 'Em andamento', match: (o: Orc) => o.status === 'em_execucao' },
  { key: 'concluidos', label: 'Concluídos', match: (o: Orc) => o.status === 'concluido' },
  { key: 'recusados', label: 'Recusados', match: (o: Orc) => o.status === 'recusado' },
];

const SindicoOrcamentos: React.FC = () => {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orcamentos, setOrcamentos] = useState<Orc[]>([]);
  const [condos, setCondos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [activeTab, setActiveTab] = useState('pendentes');
  const [detalhes, setDetalhes] = useState<Orc | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Orc | null>(null);

  // Novo orçamento
  const [showNew, setShowNew] = useState(searchParams.get('novo') === 'true');
  const [newStep, setNewStep] = useState(1);
  const [newTipo, setNewTipo] = useState('');
  const [newTitulo, setNewTitulo] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCondo, setNewCondo] = useState('');
  const [newUnidade, setNewUnidade] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!profile?.id) return;
    const { data: condosData } = await supabase.from('condominios').select('id, name').eq('sindico_id', profile.id);
    setCondos(condosData || []);
    if (!condosData || condosData.length === 0) { setLoading(false); return; }

    const condoIds = condosData.map(c => c.id);
    const { data } = await supabase
      .from('orcamentos')
      .select('*, profiles!orcamentos_prestador_id_fkey(full_name), condominios(name)')
      .in('condominio_id', condoIds)
      .order('data_solicitacao', { ascending: false });

    setOrcamentos((data as any[]) || []);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateStatus = async (orc: Orc, novoStatus: OrcStatus, extra?: Record<string, unknown>) => {
    setActing(true);
    const { error } = await supabase.from('orcamentos').update({ status: novoStatus, ...extra }).eq('id', orc.id);

    if (error) {
      toast.error('Erro ao atualizar orçamento');
    } else {
      if (novoStatus === 'aprovado') {
        await supabase.from('pagamentos_simulados').insert({
          orcamento_id: orc.id,
          condominio_id: orc.condominio_id,
          solicitante_id: orc.solicitante_id,
          prestador_id: orc.prestador_id,
          valor: (extra?.valor_aprovado as number) ?? orc.valor_proposto ?? 0,
          descricao: `Orçamento aprovado: ${orc.titulo}`,
          status: 'pendente',
          data_vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        });
      }
      toast.success(`Status: "${STATUS_CONFIG[novoStatus].label}"`);
      fetchData();
    }
    setActing(false);
  };

  const handleDelete = async (orc: Orc) => {
    setActing(true);
    const { error } = await supabase.from('orcamentos').delete().eq('id', orc.id);
    if (error) toast.error('Erro ao excluir orçamento');
    else { toast.success('Orçamento excluído'); setConfirmDelete(null); fetchData(); }
    setActing(false);
  };

  const handleCreateOrc = async () => {
    if (!newTitulo || !newTipo || !newDesc || !newCondo) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('orcamentos').insert({
      titulo: newTitulo,
      tipo: newTipo,
      descricao: newDesc,
      status: 'enviado',
      solicitante_id: profile!.id,
      condominio_id: newCondo,
      observacoes: newUnidade || null,
    });
    if (error) {
      toast.error('Erro ao criar orçamento');
    } else {
      toast.success('Orçamento enviado para prestadores');
      setShowNew(false); setSearchParams({});
      setNewStep(1); setNewTipo(''); setNewTitulo(''); setNewDesc(''); setNewCondo(''); setNewUnidade('');
      fetchData();
    }
    setSubmitting(false);
  };

  const tabData = TABS.map(t => ({ ...t, items: orcamentos.filter(t.match) }));
  const currentTab = tabData.find(t => t.key === activeTab) ?? tabData[0];

  if (loading) return <div className="p-6 lg:p-8"><div className="h-64 bg-card rounded-xl animate-pulse" /></div>;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orçamentos</h1>
          <p className="text-muted-foreground">Gestão de orçamentos e propostas</p>
        </div>
        <Button variant="golden" onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4 mr-2" /> Novo Orçamento
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-muted p-1 gap-1 w-fit overflow-x-auto">
        {tabData.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeTab === t.key ? 'gradient-primary text-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'
            }`}>
            {t.label}
            {t.items.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs bg-secondary/20 text-secondary">{t.items.length}</span>
            )}
          </button>
        ))}
      </div>

      {currentTab.items.length === 0 ? (
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
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl shrink-0">{TIPO_EMOJI[orc.tipo] ?? '📋'}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{orc.titulo}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {(orc.condominios as any)?.name && `${(orc.condominios as any).name} · `}
                        {(orc.prestador as any)?.full_name && `Prestador: ${(orc.prestador as any).full_name} · `}
                        {orc.data_solicitacao ? new Date(orc.data_solicitacao).toLocaleDateString('pt-BR') : '—'}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${cfg.cls}`}>{cfg.label}</span>
                </div>

                {(orc.valor_proposto || orc.prazo_dias) && (
                  <div className="flex gap-4 text-xs text-muted-foreground pl-11">
                    {orc.valor_proposto && <span>Proposta: <span className="text-foreground font-medium">R$ {orc.valor_proposto.toFixed(2)}</span></span>}
                    {orc.prazo_dias && <span>Prazo: <span className="text-foreground font-medium">{orc.prazo_dias}d</span></span>}
                  </div>
                )}

                <div className="flex gap-2 flex-wrap pl-11">
                  <Button variant="outline" size="sm" className="text-xs" onClick={() => setDetalhes(orc)}>Detalhes</Button>

                  {/* Aprovar / Recusar proposta */}
                  {orc.status === 'em_analise' && orc.valor_proposto && (
                    <>
                      <Button variant="golden" size="sm" className="text-xs" disabled={acting}
                        onClick={() => updateStatus(orc, 'aprovado', { valor_aprovado: orc.valor_proposto, data_aprovacao: new Date().toISOString() })}>
                        Aprovar R$ {orc.valor_proposto.toFixed(2)}
                      </Button>
                      <Button variant="outline" size="sm" className="text-xs" disabled={acting}
                        onClick={() => updateStatus(orc, 'recusado')}>
                        Recusar
                      </Button>
                    </>
                  )}

                  {/* Cancelar enviado */}
                  {orc.status === 'enviado' && (
                    <Button variant="outline" size="sm" className="text-xs" disabled={acting}
                      onClick={() => updateStatus(orc, 'cancelado')}>
                      Cancelar
                    </Button>
                  )}

                  {!['concluido', 'cancelado'].includes(orc.status) && (
                    <Button variant="outline" size="sm" className="text-xs text-destructive hover:text-destructive"
                      onClick={() => setConfirmDelete(orc)}>
                      Excluir
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Detalhes / Relatório */}
      <Dialog open={!!detalhes} onOpenChange={() => setDetalhes(null)}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle className="text-foreground">{detalhes?.titulo}</DialogTitle></DialogHeader>
          {detalhes && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Status</span>
                  <p><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CONFIG[detalhes.status].cls}`}>{STATUS_CONFIG[detalhes.status].label}</span></p></div>
                <div><span className="text-muted-foreground">Tipo</span><p className="text-foreground font-medium capitalize">{detalhes.tipo}</p></div>
                <div><span className="text-muted-foreground">Condomínio</span><p className="text-foreground font-medium">{(detalhes.condominios as any)?.name ?? '—'}</p></div>
                <div><span className="text-muted-foreground">Prestador</span><p className="text-foreground font-medium">{(detalhes.prestador as any)?.full_name ?? '—'}</p></div>
                {detalhes.valor_proposto && <div><span className="text-muted-foreground">Proposta</span><p className="text-foreground font-medium">R$ {detalhes.valor_proposto.toFixed(2)}</p></div>}
                {detalhes.valor_aprovado && <div><span className="text-muted-foreground">Aprovado</span><p className="text-success font-medium">R$ {detalhes.valor_aprovado.toFixed(2)}</p></div>}
                {detalhes.prazo_dias && <div><span className="text-muted-foreground">Prazo</span><p className="text-foreground font-medium">{detalhes.prazo_dias} dias</p></div>}
              </div>
              {detalhes.descricao && <div className="pt-2 border-t border-border"><p className="text-muted-foreground mb-1">Descrição</p><p className="text-foreground">{detalhes.descricao}</p></div>}
              {detalhes.observacoes && <div className="pt-2 border-t border-border"><p className="text-muted-foreground mb-1">Observações</p><p className="text-foreground italic">"{detalhes.observacoes}"</p></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Confirmar Exclusão */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">Excluir Orçamento</DialogTitle></DialogHeader>
          <p className="text-muted-foreground text-sm">Tem certeza que deseja excluir "<strong>{confirmDelete?.titulo}</strong>"? Esta ação não pode ser desfeita.</p>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={acting} onClick={() => confirmDelete && handleDelete(confirmDelete)}>
              {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Novo Orçamento */}
      <Dialog open={showNew} onOpenChange={open => { if (!open) { setShowNew(false); setSearchParams({}); setNewStep(1); setNewTipo(''); setNewTitulo(''); setNewDesc(''); setNewCondo(''); setNewUnidade(''); } }}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader><DialogTitle className="text-foreground">{newStep === 1 ? 'Tipo de Serviço' : 'Detalhes do Orçamento'}</DialogTitle></DialogHeader>
          {newStep === 1 ? (
            <div className="grid grid-cols-2 gap-3">
              {TIPO_OPTIONS.map(t => (
                <button key={t.value} onClick={() => { setNewTipo(t.value); setNewStep(2); }}
                  className={`p-4 rounded-xl border text-center transition-all hover:border-secondary ${newTipo === t.value ? 'border-secondary bg-secondary/10' : 'border-border'}`}>
                  <span className="text-2xl block mb-1">{t.icon}</span>
                  <span className="text-sm font-medium text-foreground">{t.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div><Label className="text-foreground/80">Título *</Label><Input value={newTitulo} onChange={e => setNewTitulo(e.target.value)} className="bg-muted mt-1" placeholder="Ex: Reforma elétrica" /></div>
              <div><Label className="text-foreground/80">Condomínio *</Label>
                <select value={newCondo} onChange={e => setNewCondo(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground mt-1">
                  <option value="">Selecione...</option>
                  {condos.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div><Label className="text-foreground/80">Unidade (opcional)</Label><Input value={newUnidade} onChange={e => setNewUnidade(e.target.value)} className="bg-muted mt-1" placeholder="Ex: Apto 201" /></div>
              <div><Label className="text-foreground/80">Descrição *</Label>
                <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Descreva o serviço necessário..." className="bg-muted mt-1 resize-none" rows={4} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setNewStep(1)}>Voltar</Button>
                <Button variant="golden" className="flex-1" onClick={handleCreateOrc} disabled={submitting || !newTitulo || !newDesc || !newCondo}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar Orçamento'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SindicoOrcamentos;
