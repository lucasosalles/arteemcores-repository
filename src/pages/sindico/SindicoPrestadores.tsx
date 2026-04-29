import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, XCircle, Users, Plus, Pencil, Trash2, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  email?: string | null;
  phone: string | null;
  disponivel: boolean | null;
  especialidades: string[] | null;
  tempo_medio_execucao_dias: number | null;
  condominioIds: string[];
}

interface SearchResult {
  id: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
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
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [addCondoId, setAddCondoId] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  // Modal — Editar acesso
  const [editPrestador, setEditPrestador] = useState<Prestador | null>(null);
  const [editCondoIds, setEditCondoIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Modal — Remover confirmação
  const [removeTarget, setRemoveTarget] = useState<{ prestador: Prestador; condoId: string } | null>(null);
  const [removing, setRemoving] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);

    const { data: condosData } = await supabase
      .from('condominios')
      .select('id, name')
      .eq('sindico_id', profile.id);

    if (!condosData || condosData.length === 0) { setLoading(false); return; }
    setCondos(condosData);

    const condoIds = condosData.map((c: Condo) => c.id);

    // Busca vínculos da tabela prestador_condominios
    const { data: vinculos } = await supabase
      .from('prestador_condominios')
      .select('prestador_id, condominio_id')
      .in('condominio_id', condoIds);

    if (!vinculos || vinculos.length === 0) { setPrestadores([]); setLoading(false); return; }

    const prestadorIds = [...new Set(vinculos.map((v: any) => v.prestador_id))];

    const [profilesRes, dispRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, email, phone').in('id', prestadorIds),
      supabase.from('disponibilidade_prestador').select('prestador_id, disponivel, especialidades, tempo_medio_execucao_dias').in('prestador_id', prestadorIds),
    ]);

    const dispMap = new Map((dispRes.data || []).map((d: any) => [d.prestador_id, d]));

    const lista: Prestador[] = (profilesRes.data || []).map((p: any) => {
      const disp = dispMap.get(p.id);
      const condIds = vinculos.filter((v: any) => v.prestador_id === p.id).map((v: any) => v.condominio_id);
      return {
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        phone: p.phone,
        disponivel: disp?.disponivel ?? null,
        especialidades: disp?.especialidades ?? null,
        tempo_medio_execucao_dias: disp?.tempo_medio_execucao_dias ?? null,
        condominioIds: condIds,
      };
    });

    lista.sort((a, b) => {
      if (a.disponivel === b.disponivel) return 0;
      return a.disponivel === true ? -1 : 1;
    });

    setPrestadores(lista);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Busca de prestadores no sistema por nome ou email
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    setSelectedResult(null);

    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone')
      .or(`full_name.ilike.%${searchQuery.trim()}%,email.ilike.%${searchQuery.trim()}%`)
      .limit(10);

    // Filtra apenas prestadores (via user_roles)
    const ids = (data || []).map((p: any) => p.id);
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'prestador')
      .in('user_id', ids);

    const prestadorRoleIds = new Set((roles || []).map((r: any) => r.user_id));
    setSearchResults((data || []).filter((p: any) => prestadorRoleIds.has(p.id)));
    setSearching(false);
  };

  const handleAdd = async () => {
    if (!selectedResult || !addCondoId) return;
    setAdding(true);
    setAddError('');

    const { error } = await supabase
      .from('prestador_condominios')
      .insert({ prestador_id: selectedResult.id, condominio_id: addCondoId });

    if (error) {
      setAddError(error.code === '23505' ? 'Prestador já vinculado a este condomínio.' : error.message);
      setAdding(false);
      return;
    }

    setShowAdd(false);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedResult(null);
    setAddCondoId('');
    setAdding(false);
    fetchAll();
  };

  const handleEditOpen = (p: Prestador) => {
    setEditPrestador(p);
    setEditCondoIds([...p.condominioIds]);
  };

  const toggleEditCondo = (condoId: string) => {
    setEditCondoIds(prev =>
      prev.includes(condoId) ? prev.filter(id => id !== condoId) : [...prev, condoId]
    );
  };

  const handleEditSave = async () => {
    if (!editPrestador) return;
    setSaving(true);

    const toAdd = editCondoIds.filter(id => !editPrestador.condominioIds.includes(id));
    const toRemove = editPrestador.condominioIds.filter(id => !editCondoIds.includes(id));

    const ops: Promise<any>[] = [];

    if (toAdd.length > 0) {
      ops.push(supabase.from('prestador_condominios').insert(
        toAdd.map(condoId => ({ prestador_id: editPrestador.id, condominio_id: condoId }))
      ));
    }

    if (toRemove.length > 0) {
      ops.push(supabase.from('prestador_condominios')
        .delete()
        .eq('prestador_id', editPrestador.id)
        .in('condominio_id', toRemove));
    }

    await Promise.all(ops);
    setSaving(false);
    setEditPrestador(null);
    fetchAll();
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    await supabase
      .from('prestador_condominios')
      .delete()
      .eq('prestador_id', removeTarget.prestador.id)
      .eq('condominio_id', removeTarget.condoId);
    setRemoving(false);
    setRemoveTarget(null);
    fetchAll();
  };

  const condoName = (id: string) => condos.find(c => c.id === id)?.name ?? id;

  const filtered = prestadores.filter(p => {
    if (filtroDisp === 'disponivel' && p.disponivel !== true) return false;
    if (filtroDisp === 'indisponivel' && p.disponivel === true) return false;
    if (filtroEsp && !(p.especialidades ?? []).includes(filtroEsp)) return false;
    return true;
  });

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Prestadores</h1>
          <p className="text-muted-foreground">Prestadores vinculados ao seu condomínio</p>
        </div>
        <Button variant="golden" size="sm" onClick={() => { setShowAdd(true); setAddCondoId(condos[0]?.id ?? ''); }}>
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
          <p className="mb-4">{prestadores.length === 0 ? 'Nenhum prestador vinculado ainda.' : 'Nenhum prestador encontrado para os filtros selecionados.'}</p>
          {prestadores.length === 0 && (
            <Button variant="golden" size="sm" onClick={() => { setShowAdd(true); setAddCondoId(condos[0]?.id ?? ''); }}>
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
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditOpen(p)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted hover:bg-muted/70 text-foreground transition-colors"
                        >
                          <Pencil className="w-3 h-3" /> Editar acesso
                        </button>
                        <button
                          onClick={() => setRemoveTarget({ prestador: p, condoId: p.condominioIds[0] ?? '' })}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
                        >
                          <Trash2 className="w-3 h-3" /> Remover
                        </button>
                      </div>
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
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Adicionar Prestador</h2>
              <button onClick={() => { setShowAdd(false); setSearchQuery(''); setSearchResults([]); setSelectedResult(null); setAddError(''); }}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Busca */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Buscar por nome ou email</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Ex: João ou joao@email.com"
                  className="flex-1 px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground"
                />
                <Button variant="outline" size="sm" onClick={handleSearch} disabled={searching}>
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Resultados */}
            {searching && <p className="text-sm text-muted-foreground">Buscando...</p>}
            {!searching && searchResults.length > 0 && (
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {searchResults.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedResult(r)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedResult?.id === r.id
                        ? 'gradient-primary text-foreground'
                        : 'bg-muted hover:bg-muted/70 text-foreground'
                    }`}
                  >
                    <p className="font-semibold">{r.full_name}</p>
                    {r.email && <p className="text-xs opacity-70">{r.email}</p>}
                  </button>
                ))}
              </div>
            )}
            {!searching && searchQuery && searchResults.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum prestador encontrado.</p>
            )}

            {/* Seleção do condomínio (se houver mais de um) */}
            {condos.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Vincular ao condomínio</label>
                <select
                  value={addCondoId}
                  onChange={e => setAddCondoId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground"
                >
                  {condos.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {addError && <p className="text-sm text-destructive">{addError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => { setShowAdd(false); setSearchQuery(''); setSearchResults([]); setSelectedResult(null); setAddError(''); }}>
                Cancelar
              </Button>
              <Button variant="golden" size="sm" onClick={handleAdd} disabled={!selectedResult || !addCondoId || adding}>
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
              <button onClick={() => setEditPrestador(null)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">Selecione os condomínios que <span className="text-foreground font-semibold">{editPrestador.full_name}</span> atenderá:</p>
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
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setEditPrestador(null)}>Cancelar</Button>
              <Button variant="golden" size="sm" onClick={handleEditSave} disabled={saving || editCondoIds.length === 0}>
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal Remover confirmação ─── */}
      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card rounded-2xl w-full max-w-sm p-6 space-y-4 border border-border shadow-xl">
            <h2 className="text-lg font-bold text-foreground">Remover prestador</h2>
            {removeTarget.prestador.condominioIds.length > 1 ? (
              <>
                <p className="text-sm text-muted-foreground">
                  <span className="text-foreground font-semibold">{removeTarget.prestador.full_name}</span> está vinculado a {removeTarget.prestador.condominioIds.length} condomínios. Selecione de qual deseja remover:
                </p>
                <select
                  value={removeTarget.condoId}
                  onChange={e => setRemoveTarget({ ...removeTarget, condoId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground"
                >
                  {removeTarget.prestador.condominioIds.map(cid => (
                    <option key={cid} value={cid}>{condoName(cid)}</option>
                  ))}
                </select>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Deseja desvincular <span className="text-foreground font-semibold">{removeTarget.prestador.full_name}</span> do condomínio <span className="text-foreground font-semibold">{condoName(removeTarget.condoId)}</span>?
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setRemoveTarget(null)}>Cancelar</Button>
              <Button
                size="sm"
                className="bg-destructive hover:bg-destructive/90 text-white"
                onClick={handleRemove}
                disabled={removing || !removeTarget.condoId}
              >
                {removing ? 'Removendo...' : 'Remover'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
