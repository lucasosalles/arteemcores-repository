import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ClipboardList, Loader2 } from 'lucide-react';

const TIPO_EMOJI: Record<string, string> = {
  reparo: '🔧', arquitetura: '🏛️', limpeza: '🧹', seguranca: '🔒', outro: '➕',
  pintura_interna: '🖌️', pintura_fachada: '🏗️', esquadria: '🪟', teto: '🛖',
  urgencia: '⚡', outros: '➕', pintura: '🖌️', eletrica: '⚡', hidraulica: '🚿', jardinagem: '🌿',
};

const TIPO_LABEL: Record<string, string> = {
  reparo: 'Reparo', arquitetura: 'Arquitetura', limpeza: 'Limpeza', seguranca: 'Segurança',
  pintura: 'Pintura', eletrica: 'Elétrica', hidraulica: 'Hidráulica', jardinagem: 'Jardinagem',
  pintura_interna: 'Pintura Interna', pintura_fachada: 'Pintura Fachada', esquadria: 'Esquadria',
  teto: 'Teto', urgencia: 'Urgência', outro: 'Outro', outros: 'Outros',
};

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

const PRIO_CONFIG: Record<string, { label: string; cls: string; order: number }> = {
  urgente: { label: 'Urgente', cls: 'bg-destructive/20 text-destructive', order: 0 },
  alta:    { label: 'Alta',    cls: 'bg-destructive/20 text-destructive', order: 1 },
  media:   { label: 'Média',   cls: 'bg-warning/20 text-warning',        order: 2 },
  normal:  { label: 'Normal',  cls: 'bg-muted text-muted-foreground',     order: 3 },
  baixa:   { label: 'Baixa',   cls: 'bg-muted text-muted-foreground',     order: 4 },
};

const STATUS_TABS = [
  { value: 'todos', label: 'Todos' },
  { value: 'ativo', label: 'Ativos' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'concluido', label: 'Concluídos' },
];

const TIPOS_FILTER = [
  'reparo', 'arquitetura', 'limpeza', 'seguranca', 'pintura', 'eletrica', 'hidraulica', 'jardinagem', 'outro',
];

export default function PrestadorChamados() {
  const { profile } = useAuth();
  const [chamados, setChamados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [detalhes, setDetalhes] = useState<any>(null);
  const [updateTarget, setUpdateTarget] = useState<any>(null);
  const [novoStatus, setNovoStatus] = useState<'em_andamento' | 'concluido'>('em_andamento');
  const [observacao, setObservacao] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchChamados = useCallback(async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('chamados')
      .select('*')
      .eq('atribuido_para', profile.id);
    setChamados(data || []);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { fetchChamados(); }, [fetchChamados]);

  const handleUpdateStatus = async () => {
    if (!updateTarget) return;
    setUpdating(true);
    const updates: any = { status: novoStatus };
    if (novoStatus === 'concluido') updates.concluded_at = new Date().toISOString();

    const { error } = await supabase.from('chamados').update(updates).eq('id', updateTarget.id);
    if (error) {
      toast.error('Erro ao atualizar status', { description: error.message });
    } else {
      toast.success(`Status atualizado para "${STATUS_CONFIG[novoStatus]?.label}"`);
      setUpdateTarget(null);
      setObservacao('');
      fetchChamados();
    }
    setUpdating(false);
  };

  const filtered = chamados
    .filter(c => {
      if (filtroStatus === 'ativo') {
        if (!['atribuido', 'aceito', 'a_caminho', 'em_andamento'].includes(c.status)) return false;
      } else if (filtroStatus !== 'todos') {
        if (c.status !== filtroStatus) return false;
      }
      if (filtroTipo && c.tipo !== filtroTipo) return false;
      return true;
    })
    .sort((a, b) => {
      const pa = (PRIO_CONFIG[a.prioridade] ?? PRIO_CONFIG.normal).order;
      const pb = (PRIO_CONFIG[b.prioridade] ?? PRIO_CONFIG.normal).order;
      if (pa !== pb) return pa - pb;
      return new Date(a.data_abertura || a.created_at).getTime() - new Date(b.data_abertura || b.created_at).getTime();
    });

  const canUpdate = (c: any) => ['atribuido', 'aceito', 'a_caminho', 'em_andamento'].includes(c.status);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meus Chamados</h1>
        <p className="text-muted-foreground">Chamados atribuídos a você</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="flex rounded-xl bg-muted p-1 gap-1 overflow-x-auto">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setFiltroStatus(tab.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                filtroStatus === tab.value ? 'gradient-primary text-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          className="px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground"
        >
          <option value="">Todos os tipos</option>
          {TIPOS_FILTER.map(t => (
            <option key={t} value={t}>{TIPO_LABEL[t] ?? t}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-card rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">
          <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>{chamados.length === 0 ? 'Nenhum chamado atribuído a você.' : 'Nenhum chamado para os filtros selecionados.'}</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-4 text-muted-foreground font-medium">Unidade / Título</th>
                  <th className="text-left p-4 text-muted-foreground font-medium hidden sm:table-cell">Tipo</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Status</th>
                  <th className="text-left p-4 text-muted-foreground font-medium hidden md:table-cell">Prioridade</th>
                  <th className="text-left p-4 text-muted-foreground font-medium hidden lg:table-cell">Abertura</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const st = STATUS_CONFIG[c.status] ?? { label: c.status, cls: 'bg-muted text-muted-foreground' };
                  const pr = PRIO_CONFIG[c.prioridade] ?? PRIO_CONFIG.normal;
                  return (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{TIPO_EMOJI[c.tipo] ?? '📋'}</span>
                          <div>
                            <p className="font-semibold text-foreground text-sm">
                              #{String(c.numero).padStart(4, '0')} {c.titulo || c.local}
                            </p>
                            <p className="text-xs text-muted-foreground">{c.local}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground hidden sm:table-cell">
                        {TIPO_LABEL[c.tipo] ?? c.tipo}
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="p-4 hidden md:table-cell">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${pr.cls}`}>{pr.label}</span>
                      </td>
                      <td className="p-4 text-muted-foreground text-xs hidden lg:table-cell">
                        {new Date(c.data_abertura || c.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="text-xs" onClick={() => setDetalhes(c)}>
                            Detalhes
                          </Button>
                          {canUpdate(c) && (
                            <Button variant="golden" size="sm" className="text-xs" onClick={() => {
                              setUpdateTarget(c);
                              setNovoStatus('em_andamento');
                              setObservacao('');
                            }}>
                              Atualizar
                            </Button>
                          )}
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

      {/* Modal Ver Detalhes */}
      <Dialog open={!!detalhes} onOpenChange={() => setDetalhes(null)}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {detalhes && `#${String(detalhes.numero).padStart(4, '0')} — ${detalhes.titulo || detalhes.local}`}
            </DialogTitle>
          </DialogHeader>
          {detalhes && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-muted-foreground">Tipo</span><p className="text-foreground font-medium">{TIPO_LABEL[detalhes.tipo] ?? detalhes.tipo}</p></div>
                <div><span className="text-muted-foreground">Prioridade</span><p className="text-foreground font-medium capitalize">{detalhes.prioridade}</p></div>
                <div><span className="text-muted-foreground">Status</span><p className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${(STATUS_CONFIG[detalhes.status] ?? STATUS_CONFIG.aberto).cls}`}>{(STATUS_CONFIG[detalhes.status] ?? STATUS_CONFIG.aberto).label}</p></div>
                <div><span className="text-muted-foreground">Local</span><p className="text-foreground font-medium">{detalhes.local || '—'}</p></div>
                <div><span className="text-muted-foreground">Abertura</span><p className="text-foreground font-medium">{new Date(detalhes.data_abertura || detalhes.created_at).toLocaleDateString('pt-BR')}</p></div>
                {detalhes.concluded_at && (
                  <div><span className="text-muted-foreground">Conclusão</span><p className="text-foreground font-medium">{new Date(detalhes.concluded_at).toLocaleDateString('pt-BR')}</p></div>
                )}
              </div>
              {detalhes.descricao && (
                <div className="pt-2 border-t border-border">
                  <p className="text-muted-foreground mb-1">Descrição</p>
                  <p className="text-foreground">{detalhes.descricao}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Atualizar Status */}
      <Dialog open={!!updateTarget} onOpenChange={open => { if (!open) setUpdateTarget(null); }}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Atualizar Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-foreground/80">Novo status</Label>
              <div className="flex gap-3 mt-2">
                {(['em_andamento', 'concluido'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setNovoStatus(s)}
                    className={`flex-1 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                      novoStatus === s
                        ? s === 'concluido' ? 'border-success bg-success/10 text-success' : 'border-orange-400 bg-orange-500/10 text-orange-400'
                        : 'border-border text-muted-foreground hover:border-secondary/50'
                    }`}
                  >
                    {s === 'em_andamento' ? 'Em Andamento' : 'Concluído'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-foreground/80">Observação (opcional)</Label>
              <Textarea
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                placeholder="Descreva o andamento ou resultado..."
                className="bg-muted mt-1 resize-none"
                rows={3}
              />
            </div>
            <p className="text-xs text-muted-foreground">Upload de foto disponível em breve.</p>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setUpdateTarget(null)}>Cancelar</Button>
            <Button variant="golden" onClick={handleUpdateStatus} disabled={updating}>
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
