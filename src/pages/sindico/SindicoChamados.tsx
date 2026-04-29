import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { abrirChamado } from '@/lib/chamadoFlow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Search, Loader2, CheckCircle2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

const TIPO_OPTIONS = [
  { value: 'reparo', label: 'Reparo', icon: '🔧' },
  { value: 'arquitetura', label: 'Arquitetura', icon: '🏛️' },
  { value: 'limpeza', label: 'Limpeza', icon: '🧹' },
  { value: 'seguranca', label: 'Segurança', icon: '🔒' },
  { value: 'pintura', label: 'Pintura', icon: '🖌️' },
  { value: 'eletrica', label: 'Elétrica', icon: '⚡' },
  { value: 'hidraulica', label: 'Hidráulica', icon: '🚿' },
  { value: 'outro', label: 'Outro', icon: '➕' },
] as const;

const TIPO_EMOJI: Record<string, string> = {
  reparo: '🔧', arquitetura: '🏛️', limpeza: '🧹', seguranca: '🔒',
  pintura: '🖌️', eletrica: '⚡', hidraulica: '🚿', outro: '➕',
  pintura_interna: '🖌️', pintura_fachada: '🏗️', esquadria: '🪟', urgencia: '⚡', outros: '➕',
};

const PRIO_OPTIONS = [
  { value: 'baixa',   label: 'Baixa',   cls: 'border-muted-foreground text-muted-foreground' },
  { value: 'media',   label: 'Média',   cls: 'border-warning text-warning' },
  { value: 'alta',    label: 'Alta',    cls: 'border-destructive text-destructive' },
] as const;

const PRIO_ORDER: Record<string, number> = { urgente: 0, alta: 1, media: 2, normal: 3, baixa: 4 };

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  aberto:       { label: 'Aberto',       cls: 'bg-warning/20 text-warning' },
  atribuido:    { label: 'Atribuído',    cls: 'bg-blue-500/20 text-blue-400' },
  aceito:       { label: 'Aceito',       cls: 'bg-blue-500/20 text-blue-400' },
  a_caminho:    { label: 'A Caminho',    cls: 'bg-blue-500/20 text-blue-400' },
  em_andamento: { label: 'Em Andamento', cls: 'bg-orange-500/20 text-orange-400' },
  concluido:    { label: 'Concluído',    cls: 'bg-success/20 text-success' },
  cancelado:    { label: 'Cancelado',    cls: 'bg-muted text-muted-foreground' },
  aguardando:   { label: 'Aguardando',   cls: 'bg-warning/20 text-warning' },
};

const PRIO_CONFIG: Record<string, { label: string; cls: string }> = {
  urgente: { label: 'Urgente', cls: 'bg-destructive/20 text-destructive' },
  alta:    { label: 'Alta',    cls: 'bg-destructive/20 text-destructive' },
  media:   { label: 'Média',   cls: 'bg-warning/20 text-warning' },
  normal:  { label: 'Normal',  cls: 'bg-muted text-muted-foreground' },
  baixa:   { label: 'Baixa',   cls: 'bg-muted text-muted-foreground' },
};

const STATUS_TABS = [
  { value: 'todos', label: 'Todos' },
  { value: 'aberto', label: 'Abertos' },
  { value: 'ativo', label: 'Em Andamento' },
  { value: 'concluido', label: 'Concluídos' },
];

const SindicoChamados: React.FC = () => {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [condos, setCondos] = useState<any[]>([]);
  const [chamados, setChamados] = useState<any[]>([]);
  const [prestadores, setPrestadores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroPrio, setFiltroPrio] = useState('');
  const [filtroCondo, setFiltroCondo] = useState('');
  const [search, setSearch] = useState('');

  // Modals
  const [showNew, setShowNew] = useState(searchParams.get('novo') === 'true');
  const [detalhes, setDetalhes] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<any>(null);
  const [trocaPrestador, setTrocaPrestador] = useState<any>(null);

  // New chamado form
  const [newStep, setNewStep] = useState(1);
  const [newTipo, setNewTipo] = useState('');
  const [newTitulo, setNewTitulo] = useState('');
  const [newLocal, setNewLocal] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrio, setNewPrio] = useState<'baixa' | 'media' | 'alta'>('media');
  const [newCondo, setNewCondo] = useState('');
  const [newPrestador, setNewPrestador] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [newNumero, setNewNumero] = useState(0);
  const [success, setSuccess] = useState(false);

  // Edit form
  const [editTitulo, setEditTitulo] = useState('');
  const [editLocal, setEditLocal] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPrio, setEditPrio] = useState('');
  const [editStatus, setEditStatus] = useState('');

  // Trocar prestador
  const [novoPrestador, setNovoPrestador] = useState('');

  const fetchData = useCallback(async () => {
    if (!profile?.id) return;

    const { data: condosData } = await supabase.from('condominios').select('id, name').eq('sindico_id', profile.id);
    setCondos(condosData || []);

    if (!condosData || condosData.length === 0) { setLoading(false); return; }
    const condoIds = condosData.map(c => c.id);

    const [chamRes, presRes] = await Promise.all([
      supabase.from('chamados').select('*, condominios(name)').in('condominio_id', condoIds).order('created_at', { ascending: false }),
      // Prestadores disponíveis: all with disponivel=true
      supabase.from('disponibilidade_prestador')
        .select('prestador_id, disponivel, especialidades, profiles!disponibilidade_prestador_prestador_id_fkey(id, full_name)')
        .eq('disponivel', true),
    ]);

    setChamados(chamRes.data || []);

    const prests = (presRes.data || []).map((d: any) => ({
      id: d.profiles?.id,
      full_name: d.profiles?.full_name,
      especialidades: d.especialidades,
    })).filter(p => p.id);
    setPrestadores(prests);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async () => {
    if (!newTitulo || !newTipo || !newLocal || !newDesc || !newCondo) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }
    setSubmitting(true);
    const result = await abrirChamado(
      { titulo: newTitulo, tipo: newTipo as any, local: newLocal, descricao: newDesc, prioridade: newPrio, condominioId: newCondo, criadoPor: profile!.id, sindicoId: profile!.id },
      'sindico',
    );
    if (!result.ok) {
      toast.error('Erro ao criar chamado', { description: result.erro });
    } else {
      // If prestador selected, assign
      if (newPrestador && result.data?.id) {
        await supabase.from('chamados').update({ atribuido_para: newPrestador, status: 'atribuido' }).eq('id', result.data.id);
      }
      setNewNumero(result.data?.numero ?? 0);
      setSuccess(true);
      fetchData();
    }
    setSubmitting(false);
  };

  const handleEdit = async () => {
    if (!editing) return;
    setSubmitting(true);
    const updates: any = { titulo: editTitulo, local: editLocal, descricao: editDesc, prioridade: editPrio, status: editStatus as any };
    if (editStatus === 'concluido') updates.concluded_at = new Date().toISOString();

    const { error } = await supabase.from('chamados').update(updates).eq('id', editing.id);
    if (error) toast.error('Erro ao editar chamado');
    else { toast.success('Chamado atualizado'); setEditing(null); fetchData(); }
    setSubmitting(false);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setSubmitting(true);
    const { error } = await supabase.from('chamados').delete().eq('id', confirmDelete.id);
    if (error) toast.error('Erro ao excluir chamado');
    else { toast.success('Chamado excluído'); setConfirmDelete(null); fetchData(); }
    setSubmitting(false);
  };

  const handleTrocarPrestador = async () => {
    if (!trocaPrestador || !novoPrestador) return;
    setSubmitting(true);
    const { error } = await supabase.from('chamados').update({ atribuido_para: novoPrestador, status: 'atribuido' as any }).eq('id', trocaPrestador.id);
    if (error) toast.error('Erro ao trocar prestador');
    else { toast.success('Prestador atualizado'); setTrocaPrestador(null); setNovoPrestador(''); fetchData(); }
    setSubmitting(false);
  };

  const resetNew = () => {
    setNewStep(1); setNewTipo(''); setNewTitulo(''); setNewLocal(''); setNewDesc('');
    setNewPrio('media'); setNewCondo(''); setNewPrestador(''); setSuccess(false);
    setShowNew(false); setSearchParams({});
  };

  const openEdit = (c: any) => {
    setEditing(c);
    setEditTitulo(c.titulo || '');
    setEditLocal(c.local || '');
    setEditDesc(c.descricao || '');
    setEditPrio(c.prioridade || 'media');
    setEditStatus(c.status || 'aberto');
  };

  const filtered = chamados
    .filter(c => {
      if (filtroStatus === 'ativo') return ['atribuido', 'aceito', 'a_caminho', 'em_andamento'].includes(c.status);
      if (filtroStatus !== 'todos') return c.status === filtroStatus;
      return true;
    })
    .filter(c => !filtroTipo || c.tipo === filtroTipo)
    .filter(c => !filtroPrio || c.prioridade === filtroPrio)
    .filter(c => !filtroCondo || c.condominio_id === filtroCondo)
    .filter(c => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (c.titulo || c.local || '').toLowerCase().includes(q) || String(c.numero).includes(q);
    })
    .sort((a, b) => {
      const pa = PRIO_ORDER[a.prioridade] ?? 3;
      const pb = PRIO_ORDER[b.prioridade] ?? 3;
      if (pa !== pb) return pa - pb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  if (loading) return <div className="p-6 lg:p-8"><div className="h-64 bg-card rounded-xl animate-pulse" /></div>;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Chamados</h1>
          <p className="text-muted-foreground">Gestão de todos os chamados</p>
        </div>
        <Button variant="golden" onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4 mr-2" /> Novo Chamado
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="flex rounded-xl bg-muted p-1 gap-1 overflow-x-auto">
          {STATUS_TABS.map(t => (
            <button key={t.value} onClick={() => setFiltroStatus(t.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${filtroStatus === t.value ? 'gradient-primary text-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground">
          <option value="">Todos os tipos</option>
          {TIPO_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={filtroPrio} onChange={e => setFiltroPrio(e.target.value)} className="px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground">
          <option value="">Todas prioridades</option>
          {PRIO_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        {condos.length > 1 && (
          <select value={filtroCondo} onChange={e => setFiltroCondo(e.target.value)} className="px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground">
            <option value="">Todos os condomínios</option>
            {condos.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-10 bg-card w-40" />
        </div>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhum chamado encontrado.</div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-4 text-muted-foreground font-medium">#</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Título / Local</th>
                  <th className="text-left p-4 text-muted-foreground font-medium hidden sm:table-cell">Tipo</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Status</th>
                  <th className="text-left p-4 text-muted-foreground font-medium hidden md:table-cell">Prioridade</th>
                  <th className="text-left p-4 text-muted-foreground font-medium hidden lg:table-cell">Data</th>
                  <th className="p-4" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const st = STATUS_CONFIG[c.status] ?? { label: c.status, cls: 'bg-muted text-muted-foreground' };
                  const pr = PRIO_CONFIG[c.prioridade] ?? PRIO_CONFIG.normal;
                  return (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="p-4 font-mono text-foreground">#{String(c.numero).padStart(4, '0')}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span>{TIPO_EMOJI[c.tipo] ?? '📋'}</span>
                          <div>
                            <p className="font-semibold text-foreground">{c.titulo || c.local}</p>
                            {condos.length > 1 && <p className="text-xs text-muted-foreground">{(c.condominios as any)?.name}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground hidden sm:table-cell capitalize">{c.tipo?.replace('_', ' ')}</td>
                      <td className="p-4"><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${st.cls}`}>{st.label}</span></td>
                      <td className="p-4 hidden md:table-cell"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${pr.cls}`}>{pr.label}</span></td>
                      <td className="p-4 text-muted-foreground text-xs hidden lg:table-cell">{new Date(c.data_abertura || c.created_at).toLocaleDateString('pt-BR')}</td>
                      <td className="p-4">
                        <div className="flex gap-1.5 justify-end">
                          <Button variant="outline" size="sm" className="text-xs" onClick={() => setDetalhes(c)}>Ver</Button>
                          <Button variant="outline" size="sm" className="text-xs" onClick={() => openEdit(c)}>Editar</Button>
                          <Button variant="outline" size="sm" className="text-xs" onClick={() => { setTrocaPrestador(c); setNovoPrestador(''); }}>Prestador</Button>
                          <Button variant="outline" size="sm" className="text-xs text-destructive hover:text-destructive" onClick={() => setConfirmDelete(c)}>Excluir</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Modal Novo Chamado ──────────────────────────────────────────────── */}
      <Dialog open={showNew} onOpenChange={open => { if (!open) resetNew(); }}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {success ? 'Chamado Criado!' : newStep === 1 ? 'Tipo de Serviço' : 'Detalhes do Chamado'}
            </DialogTitle>
          </DialogHeader>
          {success ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-success/20 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <p className="text-lg font-bold text-foreground">Chamado #{String(newNumero).padStart(4, '0')}</p>
              <p className="text-muted-foreground">Chamado criado com sucesso.</p>
              <Button variant="golden" onClick={resetNew}>Fechar</Button>
            </div>
          ) : newStep === 1 ? (
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
              <div><Label className="text-foreground/80">Título *</Label><Input value={newTitulo} onChange={e => setNewTitulo(e.target.value)} className="bg-muted mt-1" /></div>
              <div><Label className="text-foreground/80">Local / Unidade *</Label><Input value={newLocal} onChange={e => setNewLocal(e.target.value)} className="bg-muted mt-1" placeholder="Ex: Bloco A, Apto 201" /></div>
              {condos.length > 1 && (
                <div><Label className="text-foreground/80">Condomínio *</Label>
                  <select value={newCondo} onChange={e => setNewCondo(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground mt-1">
                    <option value="">Selecione...</option>
                    {condos.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              {condos.length === 1 && !newCondo && condos[0] && (
                // Auto-set if only one condo
                <input type="hidden" value={newCondo || condos[0].id} onChange={() => {}} ref={ref => { if (!newCondo && condos[0]) setNewCondo(condos[0].id); }} />
              )}
              <div>
                <Label className="text-foreground/80">Prioridade</Label>
                <div className="flex gap-2 mt-1">
                  {PRIO_OPTIONS.map(p => (
                    <button key={p.value} onClick={() => setNewPrio(p.value)}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${newPrio === p.value ? `${p.cls} border-current` : 'border-border text-muted-foreground'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div><Label className="text-foreground/80">Descrição *</Label>
                <Textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Descreva o problema ou serviço..." className="bg-muted mt-1 resize-none" rows={3} />
              </div>
              <div><Label className="text-foreground/80">Prestador (opcional)</Label>
                <select value={newPrestador} onChange={e => setNewPrestador(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground mt-1">
                  <option value="">Nenhum (a atribuir depois)</option>
                  {prestadores.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setNewStep(1)}>Voltar</Button>
                <Button variant="golden" className="flex-1" onClick={handleCreate} disabled={submitting || !newTitulo || !newLocal || !newDesc || (!newCondo && condos.length > 1)}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Chamado'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Modal Detalhes / Relatório ─────────────────────────────────────── */}
      <Dialog open={!!detalhes} onOpenChange={() => setDetalhes(null)}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle className="text-foreground">#{String(detalhes?.numero ?? '').padStart(4, '0')} — {detalhes?.titulo || detalhes?.local}</DialogTitle></DialogHeader>
          {detalhes && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Status</span><p><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${(STATUS_CONFIG[detalhes.status] ?? STATUS_CONFIG.aberto).cls}`}>{(STATUS_CONFIG[detalhes.status] ?? STATUS_CONFIG.aberto).label}</span></p></div>
                <div><span className="text-muted-foreground">Tipo</span><p className="text-foreground font-medium capitalize">{detalhes.tipo?.replace('_', ' ')}</p></div>
                <div><span className="text-muted-foreground">Prioridade</span><p className="text-foreground font-medium capitalize">{detalhes.prioridade}</p></div>
                <div><span className="text-muted-foreground">Local</span><p className="text-foreground font-medium">{detalhes.local}</p></div>
                <div><span className="text-muted-foreground">Abertura</span><p className="text-foreground font-medium">{new Date(detalhes.data_abertura || detalhes.created_at).toLocaleDateString('pt-BR')}</p></div>
                {detalhes.concluded_at && <div><span className="text-muted-foreground">Conclusão</span><p className="text-foreground font-medium">{new Date(detalhes.concluded_at).toLocaleDateString('pt-BR')}</p></div>}
              </div>
              {detalhes.descricao && <div className="pt-2 border-t border-border"><p className="text-muted-foreground mb-1">Descrição</p><p className="text-foreground">{detalhes.descricao}</p></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Modal Editar ───────────────────────────────────────────────────── */}
      <Dialog open={!!editing} onOpenChange={open => { if (!open) setEditing(null); }}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle className="text-foreground">Editar Chamado</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-foreground/80">Título</Label><Input value={editTitulo} onChange={e => setEditTitulo(e.target.value)} className="bg-muted mt-1" /></div>
            <div><Label className="text-foreground/80">Local</Label><Input value={editLocal} onChange={e => setEditLocal(e.target.value)} className="bg-muted mt-1" /></div>
            <div><Label className="text-foreground/80">Prioridade</Label>
              <div className="flex gap-2 mt-1">
                {PRIO_OPTIONS.map(p => (
                  <button key={p.value} onClick={() => setEditPrio(p.value)}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${editPrio === p.value ? `${p.cls} border-current` : 'border-border text-muted-foreground'}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-foreground/80">Status</Label>
              <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground mt-1">
                {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div><Label className="text-foreground/80">Descrição</Label><Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className="bg-muted mt-1 resize-none" rows={3} /></div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button variant="golden" onClick={handleEdit} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Modal Trocar Prestador ─────────────────────────────────────────── */}
      <Dialog open={!!trocaPrestador} onOpenChange={open => { if (!open) setTrocaPrestador(null); }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">Trocar Prestador</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Chamado: <strong className="text-foreground">{trocaPrestador?.titulo || trocaPrestador?.local}</strong></p>
            <div>
              <Label className="text-foreground/80">Selecionar prestador disponível</Label>
              <select value={novoPrestador} onChange={e => setNovoPrestador(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground mt-1">
                <option value="">Selecione...</option>
                {prestadores.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setTrocaPrestador(null)}>Cancelar</Button>
            <Button variant="golden" disabled={submitting || !novoPrestador} onClick={handleTrocarPrestador}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Modal Excluir ──────────────────────────────────────────────────── */}
      <Dialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="text-foreground">Excluir Chamado</DialogTitle></DialogHeader>
          <p className="text-muted-foreground text-sm">Tem certeza que deseja excluir o chamado <strong>#{String(confirmDelete?.numero ?? '').padStart(4, '0')}</strong>? Esta ação não pode ser desfeita.</p>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SindicoChamados;
