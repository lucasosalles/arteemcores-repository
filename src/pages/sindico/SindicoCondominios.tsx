import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Building2, Users, Wrench, ClipboardList, FileText,
  Plus, ArrowLeft, Loader2, UserPlus, CheckCircle2, XCircle,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

const PLANO_CONFIG: Record<string, { label: string; cls: string; limite: number }> = {
  essencial:    { label: 'Essencial',    cls: 'bg-muted text-muted-foreground',       limite: 10 },
  profissional: { label: 'Profissional', cls: 'bg-blue-500/20 text-blue-400',          limite: 50 },
  premium:      { label: 'Premium',      cls: 'bg-secondary/20 text-secondary',        limite: 999 },
};

const STATUS_CLS: Record<string, string> = {
  aberto: 'bg-warning/20 text-warning', em_andamento: 'bg-orange-500/20 text-orange-400',
  concluido: 'bg-success/20 text-success', cancelado: 'bg-muted text-muted-foreground',
  enviado: 'bg-blue-500/20 text-blue-400', em_analise: 'bg-warning/20 text-warning',
  em_execucao: 'bg-purple-500/20 text-purple-400', aprovado: 'bg-success/20 text-success',
};

const ESPECIALIDADE_LABEL: Record<string, string> = {
  reparo: 'Reparo', arquitetura: 'Arquitetura', limpeza: 'Limpeza', seguranca: 'Segurança',
  pintura: 'Pintura', eletrica: 'Elétrica', hidraulica: 'Hidráulica', jardinagem: 'Jardinagem', outro: 'Outro',
};

type DetailTab = 'visao' | 'moradores' | 'prestadores' | 'chamados' | 'orcamentos';

const SindicoCondominios: React.FC = () => {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [condos, setCondos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCondo, setSelectedCondo] = useState<any>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('visao');

  // Detail data
  const [moradores, setMoradores] = useState<any[]>([]);
  const [prestadores, setPrestadores] = useState<any[]>([]);
  const [chamados, setChamadosDetail] = useState<any[]>([]);
  const [orcamentos, setOrcamentosDetail] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modals
  const [showNewCondo, setShowNewCondo] = useState(searchParams.get('novo') === 'true');
  const [showNewMorador, setShowNewMorador] = useState(false);
  const [confirmRemoveMorador, setConfirmRemoveMorador] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [condoForm, setCondoForm] = useState({ name: '', address: '' , plano: 'essencial' });
  const [moradorForm, setMoradorForm] = useState({ name: '', email: '', phone: '', password: '' });

  const fetchCondos = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('condominios').select('*').eq('sindico_id', profile.id).order('created_at', { ascending: false });
    setCondos(data || []);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { fetchCondos(); }, [fetchCondos]);

  const fetchDetailData = useCallback(async (condoId: string) => {
    setDetailLoading(true);
    const [morRes, chamRes, orcRes, atribRes] = await Promise.all([
      supabase.from('profiles').select('id, full_name, phone').eq('condominio_id', condoId),
      supabase.from('chamados').select('id, numero, titulo, local, tipo, status, prioridade, data_abertura, created_at, atribuido_para')
        .eq('condominio_id', condoId).order('created_at', { ascending: false }),
      supabase.from('orcamentos').select('id, titulo, tipo, status, valor_proposto, prazo_dias, data_solicitacao')
        .eq('condominio_id', condoId).order('data_solicitacao', { ascending: false }),
      supabase.from('chamados').select('atribuido_para').eq('condominio_id', condoId).not('atribuido_para', 'is', null),
    ]);

    setMoradores(morRes.data || []);
    setChamadosDetail(chamRes.data || []);
    setOrcamentosDetail(orcRes.data || []);

    // Build prestadores list from atribuido_para
    const prestIds = [...new Set((atribRes.data || []).map((c: any) => c.atribuido_para))];
    if (prestIds.length > 0) {
      const [profRes, dispRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, phone').in('id', prestIds),
        supabase.from('disponibilidade_prestador').select('*').in('prestador_id', prestIds),
      ]);
      const dispMap = new Map((dispRes.data || []).map((d: any) => [d.prestador_id, d]));
      setPrestadores((profRes.data || []).map((p: any) => ({
        ...p,
        disponivel: dispMap.get(p.id)?.disponivel ?? null,
        especialidades: dispMap.get(p.id)?.especialidades ?? [],
      })));
    } else {
      setPrestadores([]);
    }
    setDetailLoading(false);
  }, []);

  const handleSelectCondo = (condo: any) => {
    setSelectedCondo(condo);
    setDetailTab('visao');
    fetchDetailData(condo.id);
  };

  const handleCreateCondo = async () => {
    if (!condoForm.name || !condoForm.address) {
      toast.error('Preencha nome e endereço.');
      return;
    }
    setSubmitting(true);
    const limites: Record<string, number> = { essencial: 10, profissional: 50, premium: 999 };
    const { error } = await supabase.from('condominios').insert({
      name: condoForm.name,
      address: condoForm.address,
      plano: condoForm.plano as any,
      sindico_id: profile!.id,
      limite_atendimentos: limites[condoForm.plano],
      atendimentos_mes: 0,
      ativo: true,
    });
    if (error) {
      toast.error('Erro ao criar condomínio: ' + error.message);
    } else {
      toast.success('Condomínio criado com sucesso!');
      setShowNewCondo(false); setSearchParams({});
      setCondoForm({ name: '', address: '', plano: 'essencial' });
      fetchCondos();
    }
    setSubmitting(false);
  };

  const handleCreateMorador = async () => {
    if (!moradorForm.name || !moradorForm.email || !moradorForm.password) return;
    setSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { toast.error('Sessão expirada.'); setSubmitting(false); return; }

    const { data, error } = await supabase.functions.invoke('create-user', {
      body: { email: moradorForm.email, password: moradorForm.password, full_name: moradorForm.name, phone: moradorForm.phone, role: 'morador', condominio_id: selectedCondo?.id },
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (error || data?.error) {
      toast.error('Erro ao criar morador', { description: error?.message || data?.error });
    } else {
      toast.success('Morador adicionado!');
      setShowNewMorador(false);
      setMoradorForm({ name: '', email: '', phone: '', password: '' });
      if (selectedCondo) fetchDetailData(selectedCondo.id);
    }
    setSubmitting(false);
  };

  const handleRemoveMorador = async (morador: any) => {
    setSubmitting(true);
    const { error } = await supabase.from('profiles').update({ condominio_id: null }).eq('id', morador.id);
    if (error) toast.error('Erro ao remover morador');
    else { toast.success('Morador removido'); setConfirmRemoveMorador(null); if (selectedCondo) fetchDetailData(selectedCondo.id); }
    setSubmitting(false);
  };

  if (loading) return <div className="p-6 lg:p-8"><div className="h-64 bg-card rounded-xl animate-pulse" /></div>;

  // ─── Detail Panel ─────────────────────────────────────────────────────────────
  if (selectedCondo) {
    const plano = PLANO_CONFIG[selectedCondo.plano] ?? PLANO_CONFIG.essencial;
    const usoPercent = selectedCondo.limite_atendimentos > 0
      ? Math.min(100, Math.round((selectedCondo.atendimentos_mes / selectedCondo.limite_atendimentos) * 100))
      : 0;

    const TABS: { key: DetailTab; label: string; icon: React.ReactNode }[] = [
      { key: 'visao', label: 'Visão Geral', icon: <Building2 className="w-4 h-4" /> },
      { key: 'moradores', label: `Moradores (${moradores.length})`, icon: <Users className="w-4 h-4" /> },
      { key: 'prestadores', label: `Prestadores (${prestadores.length})`, icon: <Wrench className="w-4 h-4" /> },
      { key: 'chamados', label: `Chamados (${chamados.length})`, icon: <ClipboardList className="w-4 h-4" /> },
      { key: 'orcamentos', label: `Orçamentos (${orcamentos.length})`, icon: <FileText className="w-4 h-4" /> },
    ];

    return (
      <div className="p-6 lg:p-8 space-y-6">
        {/* Back */}
        <button onClick={() => setSelectedCondo(null)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm transition-colors">
          <ArrowLeft className="w-4 h-4" /> Voltar para condomínios
        </button>

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{selectedCondo.name}</h1>
            <p className="text-muted-foreground">{selectedCondo.address}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${plano.cls}`}>{plano.label}</span>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 flex-wrap border-b border-border">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setDetailTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                detailTab === t.key ? 'border-secondary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {detailLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-card rounded-xl animate-pulse" />)}</div>
        ) : (
          <>
            {/* ─── Visão Geral ──────────────────────────────────────────────────── */}
            {detailTab === 'visao' && (
              <div className="space-y-4 max-w-lg">
                <div className="glass-card p-5 space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Nome</span><span className="text-foreground font-medium">{selectedCondo.name}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Endereço</span><span className="text-foreground font-medium">{selectedCondo.address}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Plano</span><span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${plano.cls}`}>{plano.label}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Status</span><span className={`text-foreground font-medium ${selectedCondo.ativo ? 'text-success' : 'text-destructive'}`}>{selectedCondo.ativo ? 'Ativo' : 'Inativo'}</span></div>
                </div>
                <div className="glass-card p-5 space-y-3">
                  <p className="text-sm font-semibold text-foreground uppercase tracking-wide">Uso do Plano</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Atendimentos</span>
                    <span className={`font-semibold ${usoPercent >= 100 ? 'text-destructive' : 'text-foreground'}`}>{selectedCondo.atendimentos_mes ?? 0} / {selectedCondo.limite_atendimentos ?? '—'}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className={`h-2 rounded-full transition-all ${usoPercent >= 100 ? 'bg-destructive' : 'bg-secondary'}`} style={{ width: `${usoPercent}%` }} />
                  </div>
                </div>
              </div>
            )}

            {/* ─── Moradores ────────────────────────────────────────────────────── */}
            {detailTab === 'moradores' && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button variant="golden" size="sm" onClick={() => setShowNewMorador(true)}>
                    <UserPlus className="w-4 h-4 mr-1" /> Adicionar Morador
                  </Button>
                </div>
                {moradores.length === 0 ? (
                  <div className="glass-card p-12 text-center text-muted-foreground"><Users className="w-8 h-8 mx-auto mb-2 opacity-40" /><p>Nenhum morador cadastrado.</p></div>
                ) : (
                  <div className="glass-card overflow-hidden">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-border bg-muted/30">
                        <th className="text-left p-4 text-muted-foreground font-medium">Nome</th>
                        <th className="text-left p-4 text-muted-foreground font-medium hidden sm:table-cell">Telefone</th>
                        <th className="p-4" />
                      </tr></thead>
                      <tbody>
                        {moradores.map(m => (
                          <tr key={m.id} className="border-b border-border/50 hover:bg-muted/20">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0">{m.full_name?.charAt(0)?.toUpperCase()}</div>
                                <span className="font-semibold text-foreground">{m.full_name}</span>
                              </div>
                            </td>
                            <td className="p-4 text-muted-foreground hidden sm:table-cell">{m.phone || '—'}</td>
                            <td className="p-4">
                              <Button variant="outline" size="sm" className="text-xs text-destructive hover:text-destructive" onClick={() => setConfirmRemoveMorador(m)}>Remover</Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ─── Prestadores ──────────────────────────────────────────────────── */}
            {detailTab === 'prestadores' && (
              <div className="space-y-4">
                {prestadores.length === 0 ? (
                  <div className="glass-card p-12 text-center text-muted-foreground"><Wrench className="w-8 h-8 mx-auto mb-2 opacity-40" /><p>Nenhum prestador vinculado ainda.</p><p className="text-xs mt-1">Prestadores são vinculados ao atribuir chamados.</p></div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {prestadores.map(p => (
                      <div key={p.id} className="glass-card p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground">{p.full_name?.charAt(0)?.toUpperCase()}</div>
                            <div>
                              <p className="font-semibold text-foreground">{p.full_name}</p>
                              {p.phone && <p className="text-xs text-muted-foreground">{p.phone}</p>}
                            </div>
                          </div>
                          {p.disponivel === null ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground">Sem info</span>
                          ) : p.disponivel ? (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-success/20 text-success"><CheckCircle2 className="w-3 h-3" />Disponível</span>
                          ) : (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-muted-foreground"><XCircle className="w-3 h-3" />Indisponível</span>
                          )}
                        </div>
                        {p.especialidades?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {p.especialidades.map((e: string) => (
                              <span key={e} className="px-2 py-0.5 rounded-full text-xs bg-secondary/10 text-secondary border border-secondary/20">{ESPECIALIDADE_LABEL[e] ?? e}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ─── Chamados ─────────────────────────────────────────────────────── */}
            {detailTab === 'chamados' && (
              <div className="glass-card overflow-hidden">
                {chamados.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">Nenhum chamado.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-border bg-muted/30">
                        <th className="text-left p-4 text-muted-foreground font-medium">#</th>
                        <th className="text-left p-4 text-muted-foreground font-medium">Título</th>
                        <th className="text-left p-4 text-muted-foreground font-medium hidden sm:table-cell">Tipo</th>
                        <th className="text-left p-4 text-muted-foreground font-medium">Status</th>
                      </tr></thead>
                      <tbody>
                        {chamados.map(c => (
                          <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20">
                            <td className="p-4 font-mono text-foreground">#{String(c.numero ?? '').padStart(4, '0')}</td>
                            <td className="p-4 text-foreground font-medium">{c.titulo || c.local}</td>
                            <td className="p-4 text-muted-foreground hidden sm:table-cell capitalize">{c.tipo?.replace('_', ' ')}</td>
                            <td className="p-4"><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_CLS[c.status] ?? 'bg-muted text-muted-foreground'}`}>{c.status?.replace('_', ' ')}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ─── Orçamentos ───────────────────────────────────────────────────── */}
            {detailTab === 'orcamentos' && (
              <div className="glass-card overflow-hidden">
                {orcamentos.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground">Nenhum orçamento.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-border bg-muted/30">
                        <th className="text-left p-4 text-muted-foreground font-medium">Título</th>
                        <th className="text-left p-4 text-muted-foreground font-medium hidden sm:table-cell">Valor</th>
                        <th className="text-left p-4 text-muted-foreground font-medium">Status</th>
                      </tr></thead>
                      <tbody>
                        {orcamentos.map(o => (
                          <tr key={o.id} className="border-b border-border/50 hover:bg-muted/20">
                            <td className="p-4 text-foreground font-medium">{o.titulo}</td>
                            <td className="p-4 text-muted-foreground hidden sm:table-cell">{o.valor_proposto ? `R$ ${o.valor_proposto.toFixed(2)}` : '—'}</td>
                            <td className="p-4"><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_CLS[o.status] ?? 'bg-muted text-muted-foreground'}`}>{o.status?.replace('_', ' ')}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Modal Novo Morador */}
        <Dialog open={showNewMorador} onOpenChange={open => { if (!open && !submitting) setShowNewMorador(false); }}>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle className="text-foreground">Adicionar Morador</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label className="text-foreground/80">Nome completo</Label><Input value={moradorForm.name} onChange={e => setMoradorForm({ ...moradorForm, name: e.target.value })} className="bg-muted mt-1" /></div>
              <div><Label className="text-foreground/80">Email</Label><Input type="email" value={moradorForm.email} onChange={e => setMoradorForm({ ...moradorForm, email: e.target.value })} className="bg-muted mt-1" /></div>
              <div><Label className="text-foreground/80">Telefone</Label><Input value={moradorForm.phone} onChange={e => setMoradorForm({ ...moradorForm, phone: e.target.value })} className="bg-muted mt-1" /></div>
              <div><Label className="text-foreground/80">Senha temporária</Label><Input type="password" value={moradorForm.password} onChange={e => setMoradorForm({ ...moradorForm, password: e.target.value })} className="bg-muted mt-1" /></div>
              <Button variant="golden" className="w-full" onClick={handleCreateMorador} disabled={submitting || !moradorForm.name || !moradorForm.email || !moradorForm.password}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Adicionar Morador'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal Remover Morador */}
        <Dialog open={!!confirmRemoveMorador} onOpenChange={() => setConfirmRemoveMorador(null)}>
          <DialogContent className="bg-card border-border max-w-sm">
            <DialogHeader><DialogTitle className="text-foreground">Remover Morador</DialogTitle></DialogHeader>
            <p className="text-muted-foreground text-sm">Remover <strong>{confirmRemoveMorador?.full_name}</strong> do condomínio?</p>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setConfirmRemoveMorador(null)}>Cancelar</Button>
              <Button variant="destructive" disabled={submitting} onClick={() => handleRemoveMorador(confirmRemoveMorador)}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Remover'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── Condo List ───────────────────────────────────────────────────────────────
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Condomínios</h1>
          <p className="text-muted-foreground">Seus condomínios gerenciados</p>
        </div>
        <Button variant="golden" onClick={() => setShowNewCondo(true)}>
          <Plus className="w-4 h-4 mr-2" /> Novo Condomínio
        </Button>
      </div>

      {condos.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Nenhum condomínio cadastrado.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {condos.map(c => {
            const plano = PLANO_CONFIG[c.plano] ?? PLANO_CONFIG.essencial;
            return (
              <div key={c.id} className="glass-card p-5 space-y-3 cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => handleSelectCondo(c)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-secondary" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.address}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold shrink-0 ${plano.cls}`}>{plano.label}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                  <span className="flex items-center gap-1"><ClipboardList className="w-3 h-3" />{c.atendimentos_mes ?? 0} atendimentos</span>
                  <span className="flex items-center gap-1 text-muted-foreground/60">Clique para detalhes →</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Novo Condomínio */}
      <Dialog open={showNewCondo} onOpenChange={open => { if (!open && !submitting) { setShowNewCondo(false); setSearchParams({}); } }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">Novo Condomínio</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-foreground/80">Nome *</Label><Input value={condoForm.name} onChange={e => setCondoForm({ ...condoForm, name: e.target.value })} className="bg-muted mt-1" placeholder="Ex: Residencial das Flores" /></div>
            <div><Label className="text-foreground/80">Endereço *</Label><Input value={condoForm.address} onChange={e => setCondoForm({ ...condoForm, address: e.target.value })} className="bg-muted mt-1" placeholder="Rua, número, cidade" /></div>
            <div>
              <Label className="text-foreground/80">Plano</Label>
              <select value={condoForm.plano} onChange={e => setCondoForm({ ...condoForm, plano: e.target.value })} className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm text-foreground mt-1">
                <option value="essencial">Essencial (10 atendimentos/mês)</option>
                <option value="profissional">Profissional (50 atendimentos/mês)</option>
                <option value="premium">Premium (ilimitado)</option>
              </select>
            </div>
            <Button variant="golden" className="w-full" onClick={handleCreateCondo} disabled={submitting || !condoForm.name || !condoForm.address}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Condomínio'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SindicoCondominios;
