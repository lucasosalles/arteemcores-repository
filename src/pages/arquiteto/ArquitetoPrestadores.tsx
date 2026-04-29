import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, XCircle, Users, Plus, Trash2, Search, X, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const ESPECIALIDADE_LABEL: Record<string, string> = {
  reparo: 'Reparo', arquitetura: 'Arquitetura', limpeza: 'Limpeza',
  seguranca: 'Segurança', pintura: 'Pintura', eletrica: 'Elétrica',
  hidraulica: 'Hidráulica', jardinagem: 'Jardinagem', outro: 'Outro',
};

const TODAS_ESPECIALIDADES = Object.keys(ESPECIALIDADE_LABEL);

interface Prestador {
  prestador_id: string;
  full_name: string;
  phone: string | null;
  disponivel: boolean | null;
  especialidades: string[] | null;
  tempo_medio_execucao_dias: number | null;
  total_orcamentos: number;
}

interface SearchResult {
  id: string; full_name: string; email: string | null; phone: string | null;
}

export default function ArquitetoPrestadores() {
  const { profile } = useAuth();

  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroDisp, setFiltroDisp] = useState<'todos' | 'disponivel' | 'indisponivel'>('todos');
  const [filtroEsp, setFiltroEsp] = useState('');

  // Modal Adicionar
  const [showAdd, setShowAdd] = useState(false);
  const [addTab, setAddTab] = useState<'busca' | 'base'>('busca');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [baseList, setBaseList] = useState<SearchResult[]>([]);
  const [loadingBase, setLoadingBase] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  // Confirmar remover
  const [removeTarget, setRemoveTarget] = useState<Prestador | null>(null);
  const [removing, setRemoving] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data, error } = await supabase.rpc('get_prestadores_do_arquiteto', { p_arquiteto_id: profile.id });
    if (error) { toast.error('Erro ao carregar prestadores: ' + error.message); }
    setPrestadores((data as Prestador[]) || []);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openAddModal = () => {
    setShowAdd(true); setAddTab('busca'); setSearchQuery(''); setSearchResults([]);
    setBaseList([]); setSelectedResult(null); setAddError('');
  };

  const closeAddModal = () => {
    setShowAdd(false); setSearchQuery(''); setSearchResults([]);
    setBaseList([]); setSelectedResult(null); setAddError('');
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !profile?.id) return;
    setSearching(true); setSearchResults([]); setSelectedResult(null);
    const { data, error } = await supabase.rpc('search_prestadores_for_arquiteto', {
      p_arquiteto_id: profile.id, search_term: searchQuery.trim(),
    });
    if (error) { toast.error('Erro na busca: ' + error.message); }
    setSearchResults((data as SearchResult[]) || []);
    setSearching(false);
  };

  const loadBase = useCallback(async () => {
    if (!profile?.id) return;
    setLoadingBase(true); setBaseList([]); setSelectedResult(null);
    const { data, error } = await supabase.rpc('search_prestadores_for_arquiteto', {
      p_arquiteto_id: profile.id, search_term: '',
    });
    if (error) { toast.error('Erro ao carregar base de prestadores: ' + error.message); }
    setBaseList((data as SearchResult[]) || []);
    setLoadingBase(false);
  }, [profile?.id]);

  const handleTabChange = (t: 'busca' | 'base') => {
    setAddTab(t); setSelectedResult(null);
    if (t === 'base') loadBase();
  };

  const handleAdd = async () => {
    if (!selectedResult || !profile?.id) return;
    setAdding(true); setAddError('');
    const { error } = await supabase.from('arquiteto_prestadores').insert({
      arquiteto_id: profile.id, prestador_id: selectedResult.id,
    }).select();
    if (error) {
      setAddError(error.code === '23505' ? 'Prestador já vinculado.' : `Erro: ${error.message}`);
      setAdding(false); return;
    }
    toast.success(`${selectedResult.full_name} adicionado à sua equipe.`);
    setAdding(false);
    closeAddModal();
    fetchAll();
  };

  const handleRemove = async () => {
    if (!removeTarget || !profile?.id) return;
    setRemoving(true);
    const { error } = await supabase.from('arquiteto_prestadores')
      .delete().eq('arquiteto_id', profile.id).eq('prestador_id', removeTarget.prestador_id);
    if (error) toast.error('Erro ao remover: ' + error.message);
    else toast.success('Prestador removido.');
    setRemoving(false); setRemoveTarget(null); fetchAll();
  };

  const filtered = prestadores.filter(p => {
    if (filtroDisp === 'disponivel' && p.disponivel !== true) return false;
    if (filtroDisp === 'indisponivel' && p.disponivel === true) return false;
    if (filtroEsp && !(p.especialidades ?? []).includes(filtroEsp)) return false;
    return true;
  });

  const ResultItem = ({ r }: { r: SearchResult }) => (
    <button onClick={() => setSelectedResult(r)}
      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between gap-2 ${selectedResult?.id === r.id ? 'gradient-primary text-foreground shadow-md' : 'bg-muted hover:bg-muted/70 text-foreground'}`}>
      <div>
        <p className="font-semibold">{r.full_name}</p>
        {r.email && <p className="text-xs opacity-60">{r.email}</p>}
      </div>
      {selectedResult?.id === r.id && <CheckCircle2 className="w-4 h-4 shrink-0 text-success" />}
    </button>
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Prestadores</h1>
          <p className="text-muted-foreground">Sua equipe de prestadores</p>
        </div>
        <Button variant="golden" size="sm" onClick={openAddModal}>
          <Plus className="w-4 h-4 mr-1" /> Adicionar Prestador
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="flex rounded-xl bg-muted p-1 gap-1">
          {([['todos','Todos'],['disponivel','Disponíveis'],['indisponivel','Indisponíveis']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setFiltroDisp(val)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${filtroDisp === val ? 'gradient-primary text-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'}`}>
              {label}
            </button>
          ))}
        </div>
        <select value={filtroEsp} onChange={e => setFiltroEsp(e.target.value)}
          className="px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground">
          <option value="">Todas as especialidades</option>
          {TODAS_ESPECIALIDADES.map(e => <option key={e} value={e}>{ESPECIALIDADE_LABEL[e]}</option>)}
        </select>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-28 bg-card rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="mb-4">{prestadores.length === 0 ? 'Nenhum prestador na sua equipe ainda.' : 'Nenhum resultado para os filtros selecionados.'}</p>
          {prestadores.length === 0 && (
            <Button variant="golden" size="sm" onClick={openAddModal}><Plus className="w-4 h-4 mr-1" /> Adicionar primeiro prestador</Button>
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
                  <th className="text-left p-4 text-muted-foreground font-medium">Serviços juntos</th>
                  <th className="text-right p-4 text-muted-foreground font-medium">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.prestador_id} className="border-b border-border/50 hover:bg-muted/20">
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
                    <td className="p-4 text-muted-foreground">{p.total_orcamentos}</td>
                    <td className="p-4 text-right">
                      <button onClick={() => setRemoveTarget(p)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors ml-auto">
                        <Trash2 className="w-3 h-3" /> Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Modal Adicionar ─── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card rounded-2xl w-full max-w-md p-6 space-y-4 border border-border shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Adicionar Prestador</h2>
              <button onClick={closeAddModal}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>

            <div className="flex rounded-xl bg-muted p-1 gap-1">
              <button onClick={() => handleTabChange('busca')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${addTab === 'busca' ? 'gradient-primary text-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'}`}>
                <Search className="w-3.5 h-3.5" /> Buscar
              </button>
              <button onClick={() => handleTabChange('base')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${addTab === 'base' ? 'gradient-primary text-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'}`}>
                <List className="w-3.5 h-3.5" /> Selecionar da base
              </button>
            </div>

            {addTab === 'busca' && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Nome ou email..."
                    className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground" />
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

            {addTab === 'base' && (
              <div>
                {loadingBase ? (
                  <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />)}</div>
                ) : baseList.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum prestador disponível para adicionar.</p>
                ) : (
                  <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                    {baseList.map(r => <ResultItem key={r.id} r={r} />)}
                  </div>
                )}
              </div>
            )}

            {selectedResult && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20 text-sm">
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                <span className="text-foreground font-medium">{selectedResult.full_name}</span>
                <span className="text-muted-foreground text-xs">selecionado</span>
              </div>
            )}

            {addError && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{addError}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={closeAddModal}>Cancelar</Button>
              <Button variant="golden" size="sm" onClick={handleAdd} disabled={!selectedResult || adding}>
                {adding ? 'Adicionando...' : 'Adicionar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Remover ─── */}
      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card rounded-2xl w-full max-w-sm p-6 space-y-4 border border-border shadow-xl">
            <h2 className="text-lg font-bold text-foreground">Remover prestador</h2>
            <p className="text-sm text-muted-foreground">
              Deseja remover <span className="text-foreground font-semibold">{removeTarget.full_name}</span> da sua equipe?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setRemoveTarget(null)}>Cancelar</Button>
              <Button size="sm" className="bg-destructive hover:bg-destructive/90 text-white" onClick={handleRemove} disabled={removing}>
                {removing ? 'Removendo...' : 'Remover'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
