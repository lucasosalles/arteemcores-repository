import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Loader2, FileText } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type OrcStatus =
  | 'rascunho' | 'enviado' | 'em_analise'
  | 'aprovado' | 'recusado' | 'em_execucao'
  | 'concluido' | 'cancelado';

type OrcTipo = 'reparo' | 'arquitetura' | 'limpeza' | 'seguranca' | 'outro';

interface Orcamento {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: OrcTipo;
  status: OrcStatus;
  solicitante_id: string;
  prestador_id: string | null;
  condominio_id: string | null;
  chamado_id: string | null;
  valor_proposto: number | null;
  valor_aprovado: number | null;
  prazo_dias: number | null;
  dentro_do_plano: boolean;
  data_solicitacao: string | null;
  observacoes: string | null;
}

// ─── Config ───────────────────────────────────────────────────────────────────

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

const TIPO_OPTIONS: { value: OrcTipo; label: string; icon: string }[] = [
  { value: 'reparo',       label: 'Reparo',       icon: '🔧' },
  { value: 'arquitetura',  label: 'Arquitetura',  icon: '🏛️' },
  { value: 'limpeza',      label: 'Limpeza',      icon: '🧹' },
  { value: 'seguranca',    label: 'Segurança',    icon: '🔒' },
  { value: 'outro',        label: 'Outro',        icon: '➕' },
];

const TIPO_EMOJI: Record<OrcTipo, string> = {
  reparo: '🔧', arquitetura: '🏛️', limpeza: '🧹', seguranca: '🔒', outro: '➕',
};

const TIPO_LABEL: Record<OrcTipo, string> = {
  reparo: 'Reparo', arquitetura: 'Arquitetura', limpeza: 'Limpeza',
  seguranca: 'Segurança', outro: 'Outro',
};

const isSolicitanteRole = (role: string | null) =>
  ['morador', 'sindico', 'arquiteto'].includes(role ?? '');

// ─── Component ────────────────────────────────────────────────────────────────

export default function OrcamentosPage() {
  const { profile, role } = useAuth();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  // New orcamento form
  const [showNew, setShowNew] = useState(false);
  const [step, setStep] = useState(1);
  const [tipo, setTipo] = useState<OrcTipo | ''>('');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Prestador proposta
  const [propostaOrc, setPropostaOrc] = useState<Orcamento | null>(null);
  const [valorProposto, setValorProposto] = useState('');
  const [prazoDias, setPrazoDias] = useState('');

  const isSolicitante = isSolicitanteRole(role);
  const isPrestador = role === 'prestador';

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchOrcamentos = useCallback(async () => {
    if (!profile?.id) return;

    let query = supabase
      .from('orcamentos')
      .select('*')
      .order('data_solicitacao', { ascending: false });

    if (isSolicitante) {
      query = query.eq('solicitante_id', profile.id);
    } else if (isPrestador) {
      query = query.or(`prestador_id.eq.${profile.id},and(status.eq.enviado,prestador_id.is.null)`);
    }

    const { data, error } = await query;
    if (error) toast.error('Erro ao carregar orçamentos');
    setOrcamentos((data as Orcamento[]) || []);
    setLoading(false);
  }, [profile?.id, isSolicitante, isPrestador]);

  useEffect(() => { fetchOrcamentos(); }, [fetchOrcamentos]);

  // ─── Create ─────────────────────────────────────────────────────────────────

  const resetForm = () => {
    setStep(1); setTipo(''); setTitulo(''); setDescricao('');
    setSubmitting(false); setShowNew(false);
  };

  const handleCreate = async (enviarImediatamente: boolean) => {
    if (!titulo || !tipo || descricao.length < 10) {
      toast.error('Preencha todos os campos. Descrição mínima de 10 caracteres.');
      return;
    }
    setSubmitting(true);

    const { data: condoData } = await supabase
      .from('condominios').select('id').eq('ativo', true).limit(1).maybeSingle();

    const { error } = await supabase.from('orcamentos').insert({
      titulo,
      tipo,
      descricao,
      status: enviarImediatamente ? 'enviado' : 'rascunho',
      solicitante_id: profile!.id,
      condominio_id: condoData?.id ?? null,
    });

    if (error) {
      toast.error('Erro ao criar orçamento');
    } else {
      toast.success(
        enviarImediatamente
          ? 'Orçamento enviado para prestadores'
          : 'Rascunho salvo com sucesso',
      );
      resetForm();
      fetchOrcamentos();
    }
    setSubmitting(false);
  };

  // ─── Status transitions ─────────────────────────────────────────────────────

  const updateStatus = async (
    orc: Orcamento,
    novoStatus: OrcStatus,
    extra?: Record<string, unknown>,
  ) => {
    setActing(true);
    const { error } = await supabase
      .from('orcamentos')
      .update({ status: novoStatus, ...extra })
      .eq('id', orc.id);

    if (error) {
      toast.error('Erro ao atualizar orçamento');
      setActing(false);
      return;
    }

    // Auto-create pagamento_simulado on approval
    if (novoStatus === 'aprovado') {
      const valor = (extra?.valor_aprovado as number) ?? orc.valor_proposto ?? 0;
      await supabase.from('pagamentos_simulados').insert({
        orcamento_id: orc.id,
        condominio_id: orc.condominio_id,
        solicitante_id: orc.solicitante_id,
        prestador_id: orc.prestador_id,
        valor,
        descricao: `Orçamento aprovado: ${orc.titulo}`,
        status: 'pendente',
        data_vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
      });
    }

    toast.success(`Atualizado para "${STATUS_CONFIG[novoStatus].label}"`);
    setActing(false);
    fetchOrcamentos();
  };

  // ─── Proposta ───────────────────────────────────────────────────────────────

  const handleEnviarProposta = async () => {
    if (!propostaOrc || !valorProposto || !prazoDias) {
      toast.error('Preencha valor e prazo.');
      return;
    }
    setActing(true);
    const { error } = await supabase
      .from('orcamentos')
      .update({
        valor_proposto: parseFloat(valorProposto),
        prazo_dias: parseInt(prazoDias),
      })
      .eq('id', propostaOrc.id);

    if (error) {
      toast.error('Erro ao enviar proposta');
    } else {
      toast.success('Proposta enviada ao solicitante');
      setPropostaOrc(null);
      setValorProposto('');
      setPrazoDias('');
      fetchOrcamentos();
    }
    setActing(false);
  };

  // ─── Action buttons per role/status ─────────────────────────────────────────

  const getActions = (orc: Orcamento): React.ReactNode => {
    const btns: React.ReactNode[] = [];

    if (isSolicitante) {
      if (orc.status === 'rascunho') {
        btns.push(
          <Button key="enviar" variant="golden" size="sm" disabled={acting}
            onClick={() => updateStatus(orc, 'enviado')}>
            Enviar
          </Button>,
          <Button key="cancelar" variant="outline" size="sm" disabled={acting}
            onClick={() => updateStatus(orc, 'cancelado')}>
            Cancelar
          </Button>,
        );
      }
      if (orc.status === 'enviado') {
        btns.push(
          <Button key="cancelar" variant="outline" size="sm" disabled={acting}
            onClick={() => updateStatus(orc, 'cancelado')}>
            Cancelar envio
          </Button>,
        );
      }
      if (orc.status === 'em_analise' && orc.valor_proposto) {
        btns.push(
          <Button key="aprovar" variant="golden" size="sm" disabled={acting}
            onClick={() => updateStatus(orc, 'aprovado', {
              valor_aprovado: orc.valor_proposto,
              data_aprovacao: new Date().toISOString(),
            })}>
            Aprovar R$ {orc.valor_proposto.toFixed(2)}
          </Button>,
          <Button key="recusar" variant="outline" size="sm" disabled={acting}
            onClick={() => updateStatus(orc, 'recusado')}>
            Recusar
          </Button>,
        );
      }
    }

    if (isPrestador) {
      if (orc.status === 'enviado') {
        btns.push(
          <Button key="aceitar" variant="golden" size="sm" disabled={acting}
            onClick={() => updateStatus(orc, 'em_analise', { prestador_id: profile!.id })}>
            Aceitar
          </Button>,
        );
      }
      if (orc.status === 'em_analise' && orc.prestador_id === profile?.id) {
        btns.push(
          <Button key="proposta" variant="golden" size="sm" disabled={acting}
            onClick={() => {
              setPropostaOrc(orc);
              setValorProposto(orc.valor_proposto?.toString() ?? '');
              setPrazoDias(orc.prazo_dias?.toString() ?? '');
            }}>
            {orc.valor_proposto ? 'Editar Proposta' : 'Enviar Proposta'}
          </Button>,
        );
      }
      if (orc.status === 'aprovado' && orc.prestador_id === profile?.id) {
        btns.push(
          <Button key="execucao" variant="golden" size="sm" disabled={acting}
            onClick={() => updateStatus(orc, 'em_execucao')}>
            Iniciar Execução
          </Button>,
        );
      }
      if (orc.status === 'em_execucao' && orc.prestador_id === profile?.id) {
        btns.push(
          <Button key="concluir" variant="golden" size="sm" disabled={acting}
            onClick={() => updateStatus(orc, 'concluido', {
              data_conclusao: new Date().toISOString(),
            })}>
            Concluir
          </Button>,
        );
      }
    }

    return btns.length > 0
      ? <div className="flex gap-2 flex-wrap pt-1 pl-9">{btns}</div>
      : null;
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orçamentos</h1>
          <p className="text-muted-foreground">
            {isSolicitante
              ? 'Seus orçamentos e propostas recebidas'
              : 'Orçamentos disponíveis e seus atendimentos'}
          </p>
        </div>
        {isSolicitante && (
          <Button variant="golden" onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-2" /> Novo Orçamento
          </Button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-card rounded-xl animate-pulse" />
          ))}
        </div>
      ) : orcamentos.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>
            {isSolicitante
              ? 'Nenhum orçamento ainda. Crie o primeiro!'
              : 'Nenhum orçamento disponível no momento.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {orcamentos.map(orc => {
            const actions = getActions(orc);
            const cfg = STATUS_CONFIG[orc.status];
            return (
              <div key={orc.id} className="glass-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl shrink-0">{TIPO_EMOJI[orc.tipo]}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {orc.titulo}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {orc.data_solicitacao
                          ? new Date(orc.data_solicitacao).toLocaleDateString('pt-BR')
                          : '—'}
                        {' · '}{TIPO_LABEL[orc.tipo]}
                        {orc.valor_proposto
                          ? ` · Proposta: R$ ${orc.valor_proposto.toFixed(2)}`
                          : ''}
                        {orc.prazo_dias ? ` · ${orc.prazo_dias}d` : ''}
                      </p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${cfg.cls}`}>
                    {cfg.label}
                  </span>
                </div>

                {orc.descricao && (
                  <p className="text-xs text-muted-foreground pl-9 line-clamp-2">
                    {orc.descricao}
                  </p>
                )}

                {actions}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Dialog: Novo orçamento ─────────────────────────────────────────── */}
      <Dialog open={showNew} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {step === 1 ? 'Tipo de Orçamento' : 'Detalhes do Orçamento'}
            </DialogTitle>
          </DialogHeader>

          {step === 1 ? (
            <div className="grid grid-cols-2 gap-3">
              {TIPO_OPTIONS.map(t => (
                <button
                  key={t.value}
                  onClick={() => { setTipo(t.value); setStep(2); }}
                  className={`p-4 rounded-xl border text-center transition-all hover:border-secondary ${
                    tipo === t.value ? 'border-secondary bg-secondary/10' : 'border-border'
                  }`}
                >
                  <span className="text-2xl block mb-1">{t.icon}</span>
                  <span className="text-sm font-medium text-foreground">{t.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label className="text-foreground/80">Título</Label>
                <Input
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  placeholder="Ex: Reforma elétrica da garagem"
                  className="bg-muted mt-1"
                />
              </div>
              <div>
                <Label className="text-foreground/80">Descrição</Label>
                <Textarea
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  placeholder="Descreva o serviço necessário (mín. 10 caracteres)"
                  className="bg-muted mt-1"
                  rows={4}
                />
              </div>
              <div className="flex gap-2 justify-between pt-1">
                <Button variant="outline" onClick={() => setStep(1)} disabled={submitting}>
                  Voltar
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={submitting}
                    onClick={() => handleCreate(false)}
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar Rascunho'}
                  </Button>
                  <Button
                    variant="golden"
                    disabled={submitting}
                    onClick={() => handleCreate(true)}
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enviar Orçamento'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Dialog: Proposta do prestador ─────────────────────────────────── */}
      <Dialog
        open={!!propostaOrc}
        onOpenChange={(open) => {
          if (!open) { setPropostaOrc(null); setValorProposto(''); setPrazoDias(''); }
        }}
      >
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-foreground">Enviar Proposta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-foreground/80">Valor (R$)</Label>
              <Input
                type="number"
                value={valorProposto}
                onChange={e => setValorProposto(e.target.value)}
                placeholder="0,00"
                className="bg-muted mt-1"
              />
            </div>
            <div>
              <Label className="text-foreground/80">Prazo estimado (dias)</Label>
              <Input
                type="number"
                value={prazoDias}
                onChange={e => setPrazoDias(e.target.value)}
                placeholder="Ex: 7"
                className="bg-muted mt-1"
              />
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
    </div>
  );
}
