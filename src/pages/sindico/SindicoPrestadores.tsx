import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, XCircle, Users, Plus, Pencil, Search, X, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const ESPECIALIDADE_LABEL: Record<string, string> = {
  reparo: 'Reparo', arquitetura: 'Arquitetura', limpeza: 'Limpeza',
  seguranca: 'Segurança', pintura: 'Pintura', eletrica: 'Elétrica',
  hidraulica: 'Hidráulica', jardinagem: 'Jardinagem', outro: 'Outro',
};

const TODAS_ESPECIALIDADES = Object.keys(ESPECIALIDADE_LABEL);

interface Condo { id: string; name: string; }

interface Prestador {
  id: string;
  full_name: string;
  phone: string | null;
  disponivel: boolean | null;
  especialidades: string[] | null;
  tempo_medio_execucao_dias: number | null;
  condominioIds: string[];
}

interface SearchResult {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
}

export default function SindicoPrestadores() {
  const { profile } = useAuth();

  const [condos, setCondos] = useState<Condo[]>([]);
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [loading, setLoading] = useState(true);

  const [filtroDisp, setFiltroDisp] = useState<'todos' | 'disponivel' | 'indisponivel'>('todos');
  const [filtroEsp, setFiltroEsp] = useState('');

  // Modal — Adicionar Prestador
  const [showAdd, setShowAdd] = useState(false);
  const [addCondoId, setAddCondoId] = useState('');
  const [addTab, setAddTab] = useState<'busca' | 'base'>('busca');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [baseList, setBaseList] = useState<SearchResult[]>([]);
  const [loadingBase, setLoadingBase] = useState(false);

  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  // Modal — Editar acesso
  const [editPrestador, setEditPrestador] = useState<Prestador | null>(null);
  const [editCondoIds, setEditCondoIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState(false);

  // ── Carrega dados principais ──────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);

    // Busca condominios do síndico
    const { data: condosData } = await supabase
      .from('condominios')
      .select('id, name')
      .eq('sindico_id', profile.id);

    if (!condosData || condosData.length === 0) { setLoading(false); return; }
    setCondos(condosData);

    // RPC SECURITY DEFINER — faz JOIN profiles+disponibilidade sem ser bloqueado
    // por RLS (profiles só permite SELECT para admin na policy atual)
    const { data: rows, error: rpcError } = await supabase
      .rpc('get_prestadores_do_sindico', { p_sindico_id: profile.id });

    if (rpcError) {
      toast.error('Erro ao carregar prestadores: ' + rpcError.message);
      setLoading(false);
      return;
    }

    if (!rows || rows.length === 0) { setPrestadores([]); setLoading(false); return; }

    // Agrupa por prestador_id (pode aparecer N vezes se vinculado a N condos)
    const map = new Map<string, Prestador>();
    for (const row of rows as any[]) {
      if (map.has(row.prestador_id)) {
        map.get(row.prestador_id)!.condominioIds.push(row.condominio_id);
      } else {
        map.set(row.prestador_id, {
          id: row.prestador_id,
          full_name: row.full_name,
          phone: row.phone ?? null,
          disponivel: row.disponivel ?? null,
          especialidades: row.especialidades ?? null,
          tempo_medio_execucao_dias: row.tempo_medio_execucao_dias ?? null,
          condominioIds: [row.condominio_id],
        });
      }
    }

    const lista = [...map.values()].sort((a, b) => {
      if (a.disponivel === b.disponivel) return 0;
      return a.disponivel === true ? -1 : 1;
    });

    setPrestadores(lista);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Abre modal com estado limpo ───────────────────────────────────────
  const openAddModal = () => {
    const firstCondoId = condos[0]?.id ?? '';
    setShowAdd(true);
    setAddCondoId(firstCondoId);
    setAddTab('busca');
    setSearchQuery('');
    setSearchResults([]);
    setBaseList([]);
    setSelectedResult(null);
    setAddError('');
  };

  const closeAddModal = () => {
    setShowAdd(false);
    setSearchQuery('');
    setSearchResults([]);
    setBaseList([]);
    setSelectedResult(null);
    setAddError('');
  };

  // ── Busca por nome/email (RPC) ────────────────────────────────────────
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    setSelectedResult(null);

    const { data, error } = await supabase.rpc('search_prestadores', {
      search_term: searchQuery.trim(),
      exclude_condo_id: addCondoId || null,
    });

    if (error) {
      toast.error('Erro na busca: ' + error.message);
      setSearchResults([]);
    } else {
      setSearchResults((data as SearchResult[]) || []);
    }
    setSearching(false);
  };

  // ── Carrega aba "Selecionar da base" ─────────────────────────────────
  const loadBase = useCallback(async (condoId: string) => {
    setLoadingBase(true);
    setBaseList([]);
    setSelectedResult(null);

    const { data, error } = await supabase.rpc('search_prestadores', {
      search_term: '',
      exclude_condo_id: condoId || null,
    });

    if (error) { toast.error('Erro ao carregar base de prestadores: ' + error.message); }
    setBaseList((data as SearchResult[]) || []);
    setLoadingBase(false);
  }, []);

  const handleTabChange = (tab: 'busca' | 'base') => {
    setAddTab(tab);
    setSelectedResult(null);
    if (tab === 'base') loadBase(addCondoId);
  };

  // Quando muda o condo-alvo, recarrega a aba base se estiver aberta
  const handleCondoChange = (condoId: string) => {
    setAddCondoId(condoId);
    setSelectedResult(null);
    setSearchResults([]);
    if (addTab === 'base') loadBase(condoId);
  };

  // ── Vincular prestador (via RPC SECURITY DEFINER) ────────────────────
  const handleAdd = async () => {
    if (!selectedResult || !addCondoId) {
      console.warn('[SindicoPrestadores] handleAdd bloqueado — selectedResult:', selectedResult, 'addCondoId:', addCondoId);
      setAddError(!addCondoId ? 'Nenhum condomínio selecionado. Reabra o modal e tente novamente.' : 'Selecione um prestador.');
      return;
    }

    console.log('[SindicoPrestadores] handleAdd → chamando link_prestador_to_condo com:', {
      p_prestador_id: selectedResult.id,
      p_condominio_id: addCondoId,
      prestador_nome: selectedResult.full_name,
    });

    setAdding(true);
    setAddError('');

    const rpcResult = await supabase.rpc('link_prestador_to_condo', {
      p_prestador_id: selectedResult.id,
      p_condominio_id: addCondoId,
    });

    console.log('[SindicoPrestadores] link_prestador_to_condo resultado completo:', JSON.stringify(rpcResult));

    const { error } = rpcResult;

    if (error) {
      console.error('[SindicoPrestadores] ERRO ao vincular:', error);
      const msg = error.message.includes('não é o síndico')
        ? 'Sem permissão: você não é o síndico deste condomínio.'
        : `Erro ao vincular: ${error.message} (code: ${error.code})`;
      setAddError(msg);
      // Mantém modal aberto para o usuário ver o erro
      setAdding(false);
      return;
    }

    console.log('[SindicoPrestadores] Vínculo criado com sucesso. Recarregando lista...');
    setAdding(false);
    closeAddModal();
    fetchAll();
  };

  // ── Editar acesso (quais condos o prestador atende) ───────────────────
  const handleEditOpen = (p: Prestador) => {
    setEditPrestador(p);
    setEditCondoIds([...p.condominioIds]);
    setEditError('');
    setEditSuccess(false);
  };

  const toggleEditCondo = (condoId: string) => {
    setEditCondoIds(prev =>
      prev.includes(condoId) ? prev.filter(id => id !== condoId) : [...prev, condoId]
    );
  };

  const handleEditSave = async () => {
    if (!editPrestador) return;
    setSaving(true);
    setEditError('');
    setEditSuccess(false);

    const toAdd = editCondoIds.filter(id => !editPrestador.condominioIds.includes(id));
    const toRemove = editPrestador.condominioIds.filter(id => !editCondoIds.includes(id));

    const results = await Promise.all([
      ...toAdd.map(condoId =>
        supabase.rpc('link_prestador_to_condo', {
          p_prestador_id: editPrestador.id,
          p_condominio_id: condoId,
        })
      ),
      ...toRemove.map(condoId =>
        supabase.rpc('unlink_prestador_from_condo', {
          p_prestador_id: editPrestador.id,
          p_condominio_id: condoId,
        })
      ),
    ]);

    const errors = results.map(r => r.error).filter(Boolean);
    setSaving(false);

    if (errors.length > 0) {
      console.error('[SindicoPrestadores] handleEditSave errors:', errors);
      setEditError(`Erro ao salvar: ${errors[0]!.message}`);
      return;
    }

    setEditSuccess(true);
    fetchAll();
    // Fecha modal após breve feedback de sucesso
    setTimeout(() => setEditPrestador(null), 1200);
  };

  const condoName = (id: string) => condos.find(c => c.id === id)?.name ?? id;

  const filtered = prestadores.filter(p => {
    if (filtroDisp === 'disponivel' && p.disponivel !== true) return false;
    if (filtroDisp === 'indisponivel' && p.disponivel === true) return false;
    if (filtroEsp && !(p.especialidades ?? []).includes(filtroEsp)) return false;
    return true;
  });

  // Componente de resultado reutilizável
  const ResultItem = ({ r }: { r: SearchResult }) => (
    <button
      key={r.id}
      onClick={() => setSelectedResult(r)}
      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between gap-2 ${
        selectedResult?.id === r.id
          ? 'gradient-primary text-foreground shadow-md'
          : 'bg-muted hover:bg-muted/70 text-foreground'
      }`}
    >
      <div>
        <p className="font-semibold">{r.full_name}</p>
        {r.email && <p className="text-xs opacity-60">{r.email}</p>}
      </div>
      {selectedResult?.id === r.id && (
        <CheckCircle2 className="w-4 h-4 shrink-0 text-success" />
      )}
    </button>
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Prestadores</h1>
          <p className="text-muted-foreground">Prestadores vinculados ao seu condomínio</p>
        </div>
        <Button variant="golden" size="sm" onClick={openAddModal}>
          <Plus className="w-4 h-4 mr-1" /> Adicionar Prestador
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

      {/* Tabela */}
      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-36 bg-card rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="mb-4">
            {prestadores.length === 0
              ? 'Nenhum prestador vinculado ainda.'
              : 'Nenhum prestador encontrado para os filtros selecionados.'}
          </p>
          {prestadores.length === 0 && (
            <Button variant="golden" size="sm" onClick={openAddModal}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar primeiro prestador
            </Button>
          )}
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-4 text-muted-foreground font-medium">Nome</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Especialidades</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Disponibilidade</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Condomínios</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="p-4">
                      <p className="font-semibold text-foreground">{p.full_name}</p>
                      {p.phone && <p className="text-xs text-muted-foreground mt-0.5">{p.phone}</p>}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {(p.especialidades ?? []).length > 0
                          ? p.especialidades!.map(e => (
                              <span key={e} className="px-2 py-0.5 rounded-full text-xs bg-secondary/10 text-secondary border border-secondary/20">
                                {ESPECIALIDADE_LABEL[e] ?? e}
                              </span>
                            ))
                          : <span className="text-muted-foreground text-xs">—</span>
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
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {p.condominioIds.map(cid => (
                          <span key={cid} className="px-2 py-0.5 rounded-full text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {condoName(cid)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleEditOpen(p)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted hover:bg-muted/70 text-foreground transition-colors ml-auto"
                      >
                        <Pencil className="w-3 h-3" /> Editar acesso
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Modal Adicionar Prestador ─── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card rounded-2xl w-full max-w-md p-6 space-y-4 border border-border shadow-xl">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Adicionar Prestador</h2>
              <button onClick={closeAddModal}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Seletor de condomínio (apenas se houver >1) */}
            {condos.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Vincular ao condomínio</label>
                <select
                  value={addCondoId}
                  onChange={e => handleCondoChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground"
                >
                  {condos.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {/* Abas */}
            <div className="flex rounded-xl bg-muted p-1 gap-1">
              <button
                onClick={() => handleTabChange('busca')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  addTab === 'busca' ? 'gradient-primary text-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Search className="w-3.5 h-3.5" /> Buscar por nome/email
              </button>
              <button
                onClick={() => handleTabChange('base')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  addTab === 'base' ? 'gradient-primary text-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <List className="w-3.5 h-3.5" /> Selecionar da base
              </button>
            </div>

            {/* Aba Busca */}
            {addTab === 'busca' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Ex: João ou joao@email.com"
                    className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground"
                  />
                  <Button variant="outline" size="sm" onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
                    <Search className="w-4 h-4" />
                  </Button>
                </div>
                {searching && <p className="text-sm text-muted-foreground">Buscando...</p>}
                {!searching && searchResults.length > 0 && (
                  <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                    {searchResults.map(r => <ResultItem key={r.id} r={r} />)}
                  </div>
                )}
                {!searching && searchQuery && searchResults.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum prestador encontrado.</p>
                )}
              </div>
            )}

            {/* Aba Base */}
            {addTab === 'base' && (
              <div>
                {loadingBase ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />)}
                  </div>
                ) : baseList.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum prestador disponível para vincular.
                  </p>
                ) : (
                  <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                    {baseList.map(r => <ResultItem key={r.id} r={r} />)}
                  </div>
                )}
              </div>
            )}

            {/* Prestador selecionado */}
            {selectedResult && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20 text-sm">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                <span className="text-foreground font-medium">{selectedResult.full_name}</span>
                <span className="text-muted-foreground text-xs">selecionado</span>
              </div>
            )}

            {addError && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {addError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={closeAddModal}>Cancelar</Button>
              <Button
                variant="golden"
                size="sm"
                onClick={handleAdd}
                disabled={!selectedResult || !addCondoId || adding}
              >
                {adding ? 'Vinculando...' : 'Vincular'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Editar acesso ─── */}
      {editPrestador && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card rounded-2xl w-full max-w-sm p-6 space-y-4 border border-border shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Editar acesso</h2>
              <button onClick={() => setEditPrestador(null)} disabled={saving}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              Selecione os condomínios que{' '}
              <span className="text-foreground font-semibold">{editPrestador.full_name}</span> atenderá.
              Desmarcar todos remove o prestador da lista.
            </p>
            <div className="space-y-2">
              {condos.map(c => (
                <label key={c.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted cursor-pointer hover:bg-muted/70 transition-colors">
                  <input
                    type="checkbox"
                    checked={editCondoIds.includes(c.id)}
                    onChange={() => toggleEditCondo(c.id)}
                    className="w-4 h-4 accent-secondary"
                  />
                  <span className="text-sm text-foreground">{c.name}</span>
                </label>
              ))}
            </div>

            {editError && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {editError}
              </p>
            )}
            {editSuccess && (
              <p className="text-sm text-success bg-success/10 border border-success/20 rounded-lg px-3 py-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Acesso atualizado com sucesso.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setEditPrestador(null)} disabled={saving}>
                Cancelar
              </Button>
              <Button variant="golden" size="sm" onClick={handleEditSave} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
