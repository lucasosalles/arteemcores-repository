import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus, X, Eye, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';

const TIPO_OPTIONS = [
  { value: 'reparo', label: 'Reparo' }, { value: 'arquitetura', label: 'Arquitetura' },
  { value: 'limpeza', label: 'Limpeza' }, { value: 'seguranca', label: 'Segurança' },
  { value: 'pintura', label: 'Pintura' }, { value: 'eletrica', label: 'Elétrica' },
  { value: 'hidraulica', label: 'Hidráulica' }, { value: 'jardinagem', label: 'Jardinagem' },
  { value: 'outro', label: 'Outro' },
] as const;

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  rascunho:    { label: 'Rascunho',     cls: 'bg-muted text-muted-foreground' },
  enviado:     { label: 'Enviado',      cls: 'bg-blue-500/20 text-blue-400' },
  em_analise:  { label: 'Em análise',   cls: 'bg-warning/20 text-warning' },
  aprovado:    { label: 'Aprovado',     cls: 'bg-success/20 text-success' },
  recusado:    { label: 'Recusado',     cls: 'bg-destructive/20 text-destructive' },
  em_execucao: { label: 'Em execução',  cls: 'bg-orange-500/20 text-orange-400' },
  concluido:   { label: 'Concluído',    cls: 'bg-success/20 text-success' },
  cancelado:   { label: 'Cancelado',    cls: 'bg-muted text-muted-foreground' },
};

const TABS = [
  { key: 'pendentes',  label: 'Pendentes',    statuses: ['enviado', 'em_analise'] },
  { key: 'andamento',  label: 'Em andamento', statuses: ['aprovado', 'em_execucao'] },
  { key: 'concluidos', label: 'Concluídos',   statuses: ['concluido'] },
  { key: 'recusados',  label: 'Recusados',    statuses: ['recusado', 'cancelado'] },
] as const;

export default function ArquitetoOrcamentos() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [orcamentos, setOrcamentos] = useState<any[]>([]);
  const [prestadores, setPrestadores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<typeof TABS[number]['key']>('pendentes');

  // Modal novo
  const [showNew, setShowNew] = useState(searchParams.get('novo') === 'true');
  const [newTitulo, setNewTitulo] = useState('');
  const [newTipo, setNewTipo] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrestador, setNewPrestador] = useState('');
  const [newFoto, setNewFoto] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Modal detalhes
  const [detalhes, setDetalhes] = useState<any>(null);

  // Modal confirmar recusar/cancelar
  const [confirmAction, setConfirmAction] = useState<{ orc: any; action: 'recusar' | 'cancelar' } | null>(null);

  const fetchAll = useCallback(async () => {
    if (!profile?.id) return;
    const [orcRes, presRes] = await Promise.all([
      supabase.rpc('get_arquiteto_orcamentos', { p_arquiteto_id: profile.id }),
      supabase.rpc('get_prestadores_do_arquiteto', { p_arquiteto_id: profile.id }),
    ]);
    setOrcamentos(orcRes.data || []);
    setPrestadores(presRes.data || []);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreate = async () => {
    if (!newTitulo || !newTipo || !newDesc) { toast.error('Preencha título, tipo e descrição.'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('orcamentos').insert({
      titulo: newTitulo, tipo: newTipo, descricao: newDesc,
      solicitante_id: profile!.id,
      prestador_id: newPrestador || null,
      foto_url: newFoto || null,
      status: newPrestador ? 'enviado' : 'rascunho',
    });
    if (error) { toast.error('Erro ao criar orçamento: ' + error.message); }
    else {
      toast.success('Orçamento criado!');
      setShowNew(false); setNewTitulo(''); setNewTipo(''); setNewDesc(''); setNewPrestador(''); setNewFoto('');
      setSearchParams({});
      fetchAll();
    }
    setSubmitting(false);
  };

  const updateStatus = async (orc: any, status: string, extra?: object) => {
    const { error } = await supabase.from('orcamentos').update({ status, ...extra }).eq('id', orc.id);
    if (error) toast.error('Erro: ' + error.message);
    else { toast.success('Status atualizado.'); fetchAll(); }
  };

  const handleAprovar = (orc: any) => updateStatus(orc, 'aprovado', { valor_aprovado: orc.valor_proposto, data_aprovacao: new Date().toISOString() });
  const handleRecusar = (orc: any) => updateStatus(orc, 'recusado');
  const handleCancelar = (orc: any) => updateStatus(orc, 'cancelado');

  const handleDelete = async (orc: any) => {
    const { error } = await supabase.from('orcamentos').delete().eq('id', orc.id);
    if (error) toast.error('Erro ao excluir: ' + error.message);
    else { toast.success('Orçamento excluído.'); fetchAll(); }
  };

  const currentTab = TABS.find(t => t.key === tab)!;
  const filtered = orcamentos.filter(o => currentTab.statuses.includes(o.status));

  const tabCount = (statuses: readonly string[]) => orcamentos.filter(o => statuses.includes(o.status)).length;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orçamentos</h1>
          <p className="text-muted-foreground">Solicite e gerencie seus projetos</p>
        </div>
        <Button variant="golden" size="sm" onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4 mr-1" /> Novo Orçamento
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-muted p-1 gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${tab === t.key ? 'gradient-primary text-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'}`}>
            {t.label} {tabCount(t.statuses) > 0 && <span className="ml-1 opacity-70">({tabCount(t.statuses)})</span>}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-card rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">
          <p>Nenhum orçamento nesta aba.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(o => {
            const st = STATUS_CONFIG[o.status] ?? STATUS_CONFIG.rascunho;
            return (
              <div key={o.id} className="glass-card p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground">{o.titulo}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${st.cls}`}>{st.label}</span>
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                    {o.prestador_name && <span>Prestador: {o.prestador_name}</span>}
                    {o.condominio_name && <span>Cliente: {o.condominio_name}</span>}
                    {o.valor_proposto && <span>R$ {Number(o.valor_proposto).toFixed(2)}</span>}
                    {o.prazo_dias && <span>{o.prazo_dias}d</span>}
                    <span>{new Date(o.data_solicitacao || o.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                  <button onClick={() => setDetalhes(o)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-muted hover:bg-muted/70 text-foreground transition-colors">
                    <Eye className="w-3 h-3" /> Ver
                  </button>
                  {o.status === 'em_analise' && (
                    <>
                      <button onClick={() => handleAprovar(o)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-success/10 hover:bg-success/20 text-success transition-colors">
                        <CheckCircle2 className="w-3 h-3" /> Aprovar
                      </button>
                      <button onClick={() => setConfirmAction({ orc: o, action: 'recusar' })}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors">
                        <XCircle className="w-3 h-3" /> Recusar
                      </button>
                    </>
                  )}
                  {['enviado', 'rascunho', 'aprovado'].includes(o.status) && (
                    <button onClick={() => setConfirmAction({ orc: o, action: 'cancelar' })}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-muted hover:bg-muted/70 text-muted-foreground transition-colors">
                      Cancelar
                    </button>
                  )}
                  {['recusado', 'cancelado'].includes(o.status) && (
                    <button onClick={() => handleDelete(o)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors">
                      <Trash2 className="w-3 h-3" /> Excluir
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Modal Novo Orçamento ─── */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card rounded-2xl w-full max-w-md p-6 space-y-4 border border-border shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Novo Orçamento</h2>
              <button onClick={() => { setShowNew(false); setSearchParams({}); }}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Título *</label>
                <input value={newTitulo} onChange={e => setNewTitulo(e.target.value)} placeholder="Ex: Reforma banheiro social"
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Tipo de serviço *</label>
                <select value={newTipo} onChange={e => setNewTipo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground">
                  <option value="">Selecione...</option>
                  {TIPO_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Descrição *</label>
                <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={3}
                  placeholder="Descreva o serviço desejado..."
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Prestador (opcional)</label>
                <select value={newPrestador} onChange={e => setNewPrestador(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground">
                  <option value="">Nenhum (rascunho)</option>
                  {prestadores.map((p: any) => <option key={p.prestador_id} value={p.prestador_id}>{p.full_name}</option>)}
                </select>
                {prestadores.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">Adicione prestadores na aba Prestadores primeiro.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">URL da foto (opcional)</label>
                <input value={newFoto} onChange={e => setNewFoto(e.target.value)} placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => { setShowNew(false); setSearchParams({}); }}>Cancelar</Button>
              <Button variant="golden" size="sm" onClick={handleCreate} disabled={submitting || !newTitulo || !newTipo || !newDesc}>
                {submitting ? 'Criando...' : 'Criar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Detalhes ─── */}
      {detalhes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card rounded-2xl w-full max-w-md p-6 space-y-4 border border-border shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">{detalhes.titulo}</h2>
              <button onClick={() => setDetalhes(null)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-muted-foreground text-xs">Status</p>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${(STATUS_CONFIG[detalhes.status] ?? STATUS_CONFIG.rascunho).cls}`}>
                  {(STATUS_CONFIG[detalhes.status] ?? STATUS_CONFIG.rascunho).label}
                </span>
              </div>
              <div><p className="text-muted-foreground text-xs">Tipo</p><p className="text-foreground font-medium capitalize">{detalhes.tipo}</p></div>
              {detalhes.prestador_name && <div><p className="text-muted-foreground text-xs">Prestador</p><p className="text-foreground font-medium">{detalhes.prestador_name}</p></div>}
              {detalhes.condominio_name && <div><p className="text-muted-foreground text-xs">Cliente</p><p className="text-foreground font-medium">{detalhes.condominio_name}</p></div>}
              {detalhes.valor_proposto && <div><p className="text-muted-foreground text-xs">Valor proposto</p><p className="text-foreground font-medium">R$ {Number(detalhes.valor_proposto).toFixed(2)}</p></div>}
              {detalhes.valor_aprovado && <div><p className="text-muted-foreground text-xs">Valor aprovado</p><p className="text-foreground font-medium">R$ {Number(detalhes.valor_aprovado).toFixed(2)}</p></div>}
              {detalhes.prazo_dias && <div><p className="text-muted-foreground text-xs">Prazo</p><p className="text-foreground font-medium">{detalhes.prazo_dias} dias</p></div>}
              <div><p className="text-muted-foreground text-xs">Solicitado em</p><p className="text-foreground font-medium">{new Date(detalhes.data_solicitacao || detalhes.created_at).toLocaleDateString('pt-BR')}</p></div>
            </div>
            {detalhes.observacoes && (
              <div className="pt-2 border-t border-border">
                <p className="text-muted-foreground text-xs mb-1">Observações</p>
                <p className="text-foreground text-sm">{detalhes.observacoes}</p>
              </div>
            )}
            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setDetalhes(null)}>Fechar</Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Confirmar ação ─── */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card rounded-2xl w-full max-w-sm p-6 space-y-4 border border-border shadow-xl">
            <h2 className="text-lg font-bold text-foreground capitalize">{confirmAction.action} orçamento</h2>
            <p className="text-sm text-muted-foreground">
              Deseja {confirmAction.action} o orçamento <span className="text-foreground font-semibold">"{confirmAction.orc.titulo}"</span>?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmAction(null)}>Cancelar</Button>
              <Button size="sm" className="bg-destructive hover:bg-destructive/90 text-white" onClick={() => {
                if (confirmAction.action === 'recusar') handleRecusar(confirmAction.orc);
                else handleCancelar(confirmAction.orc);
                setConfirmAction(null);
              }}>
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
