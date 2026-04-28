import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { DollarSign, TrendingUp, Clock, AlertTriangle, Loader2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type PagStatus = 'pendente' | 'pago' | 'atrasado' | 'cancelado';

interface Pagamento {
  id: string;
  descricao: string | null;
  valor: number;
  status: PagStatus;
  forma_pagamento: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
  created_at: string;
  condominio_id: string | null;
  prestador_id: string | null;
  // joined
  condominios?: { name: string } | null;
  prestador?: { full_name: string } | null;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PagStatus, { label: string; cls: string }> = {
  pago:      { label: 'Pago',      cls: 'bg-success/20 text-success' },
  pendente:  { label: 'Pendente',  cls: 'bg-warning/20 text-warning' },
  atrasado:  { label: 'Atrasado',  cls: 'bg-destructive/20 text-destructive' },
  cancelado: { label: 'Cancelado', cls: 'bg-muted text-muted-foreground' },
};

const FORMA_LABEL: Record<string, string> = {
  boleto: 'Boleto', pix: 'Pix', cartao: 'Cartão', fatura_mensal: 'Fatura',
};

const PLANO_PRECO: Record<string, number> = {
  essencial: 490, profissional: 890, premium: 1490,
};

const mesAtual = () => new Date().toISOString().slice(0, 7); // "YYYY-MM"

// ─── Component ────────────────────────────────────────────────────────────────

const AdminFinanceiro: React.FC = () => {
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);
  const [mrr, setMrr] = useState(0);

  // Filtros
  const [filtroStatus, setFiltroStatus] = useState<PagStatus | 'todos'>('todos');
  const [filtroPeriodo, setFiltroPeriodo] = useState(mesAtual());
  const [filtroBusca, setFiltroBusca] = useState('');

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchPagamentos = useCallback(async () => {
    setLoading(true);

    const [pagRes, condoRes] = await Promise.all([
      supabase
        .from('pagamentos_simulados')
        .select('*, condominios(name)')
        .order('created_at', { ascending: false }),
      supabase.from('condominios').select('plano').eq('ativo', true),
    ]);

    setPagamentos((pagRes.data as Pagamento[]) || []);

    const mrrCalc = (condoRes.data || []).reduce(
      (s, c) => s + (PLANO_PRECO[c.plano] || 0),
      0,
    );
    setMrr(mrrCalc);
    setLoading(false);
  }, []);

  useEffect(() => { fetchPagamentos(); }, [fetchPagamentos]);

  // ─── Ação: Marcar como pago ──────────────────────────────────────────────────

  const markPago = async (id: string) => {
    setMarking(id);
    const { error } = await supabase
      .from('pagamentos_simulados')
      .update({ status: 'pago', data_pagamento: new Date().toISOString().split('T')[0] })
      .eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar pagamento');
    } else {
      toast.success('Pagamento marcado como pago');
      setPagamentos(prev =>
        prev.map(p =>
          p.id === id
            ? { ...p, status: 'pago', data_pagamento: new Date().toISOString().split('T')[0] }
            : p,
        ),
      );
    }
    setMarking(null);
  };

  const markAtrasado = async (id: string) => {
    setMarking(id);
    const { error } = await supabase
      .from('pagamentos_simulados')
      .update({ status: 'atrasado' })
      .eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar pagamento');
    } else {
      toast.success('Pagamento marcado como atrasado');
      setPagamentos(prev =>
        prev.map(p => (p.id === id ? { ...p, status: 'atrasado' } : p)),
      );
    }
    setMarking(null);
  };

  // ─── Filtros aplicados ───────────────────────────────────────────────────────

  const filtrados = pagamentos.filter(p => {
    if (filtroStatus !== 'todos' && p.status !== filtroStatus) return false;

    if (filtroPeriodo) {
      const ref = (p.data_vencimento || p.created_at || '').slice(0, 7);
      if (ref !== filtroPeriodo) return false;
    }

    if (filtroBusca) {
      const q = filtroBusca.toLowerCase();
      const desc = (p.descricao || '').toLowerCase();
      const condo = ((p.condominios as any)?.name || '').toLowerCase();
      if (!desc.includes(q) && !condo.includes(q)) return false;
    }

    return true;
  });

  // ─── Totais ──────────────────────────────────────────────────────────────────

  const totalGeral   = filtrados.reduce((s, p) => s + Number(p.valor), 0);
  const totalPago    = filtrados.filter(p => p.status === 'pago').reduce((s, p) => s + Number(p.valor), 0);
  const totalPendente= filtrados.filter(p => p.status === 'pendente').reduce((s, p) => s + Number(p.valor), 0);
  const totalAtrasado= filtrados.filter(p => p.status === 'atrasado').reduce((s, p) => s + Number(p.valor), 0);

  const fmt = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>

      {/* ─── Cards de receita do SaaS ──────────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <DollarSign className="w-5 h-5 text-secondary mb-2" />
          <p className="text-2xl font-bold text-foreground">R$ {fmt(mrr)}</p>
          <p className="text-xs text-muted-foreground mt-1">MRR — Receita Mensal Recorrente</p>
        </div>
        <div className="glass-card p-5">
          <TrendingUp className="w-5 h-5 text-success mb-2" />
          <p className="text-2xl font-bold text-foreground">R$ {fmt(mrr * 12)}</p>
          <p className="text-xs text-muted-foreground mt-1">ARR — Receita Anual</p>
        </div>
      </div>

      {/* ─── Cards totais (pagamentos_simulados filtrados) ─────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total',      valor: totalGeral,    cls: 'text-foreground',    icon: <DollarSign className="w-4 h-4" /> },
          { label: 'Pago',       valor: totalPago,     cls: 'text-success',       icon: <DollarSign className="w-4 h-4" /> },
          { label: 'Pendente',   valor: totalPendente, cls: 'text-warning',       icon: <Clock className="w-4 h-4" /> },
          { label: 'Atrasado',   valor: totalAtrasado, cls: 'text-destructive',   icon: <AlertTriangle className="w-4 h-4" /> },
        ].map(card => (
          <div key={card.label} className="glass-card p-4">
            <div className={`flex items-center gap-1.5 mb-1 ${card.cls}`}>{card.icon}
              <span className="text-xs font-semibold uppercase tracking-wide">{card.label}</span>
            </div>
            <p className={`text-lg font-bold ${card.cls}`}>R$ {fmt(card.valor)}</p>
          </div>
        ))}
      </div>

      {/* ─── Filtros ───────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        {/* Status */}
        <div className="flex rounded-xl bg-muted p-1 gap-1 overflow-x-auto">
          {(['todos', 'pendente', 'pago', 'atrasado', 'cancelado'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFiltroStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                filtroStatus === s
                  ? 'gradient-primary text-foreground shadow'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s === 'todos' ? 'Todos' : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>

        {/* Período */}
        <Input
          type="month"
          value={filtroPeriodo}
          onChange={e => setFiltroPeriodo(e.target.value)}
          className="bg-card w-40 text-sm"
        />

        {/* Busca */}
        <Input
          value={filtroBusca}
          onChange={e => setFiltroBusca(e.target.value)}
          placeholder="Buscar por descrição ou condomínio…"
          className="bg-card flex-1 min-w-48 text-sm"
        />
      </div>

      {/* ─── Tabela ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-card rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 text-muted-foreground font-medium">Descrição</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Condomínio</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Valor</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Vencimento</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Forma</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
                  <th className="text-left p-3 text-muted-foreground font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Nenhum pagamento encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filtrados.map(p => {
                    const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.pendente;
                    const isMarking = marking === p.id;
                    return (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="p-3 text-foreground max-w-48 truncate">
                          {p.descricao || '—'}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {(p.condominios as any)?.name || '—'}
                        </td>
                        <td className="p-3 font-semibold text-foreground whitespace-nowrap">
                          R$ {fmt(Number(p.valor))}
                        </td>
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          {p.data_vencimento
                            ? new Date(p.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')
                            : '—'}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {p.forma_pagamento ? FORMA_LABEL[p.forma_pagamento] ?? p.forma_pagamento : '—'}
                        </td>
                        <td className="p-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.cls}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1.5 flex-wrap">
                            {p.status === 'pendente' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="golden"
                                  className="h-7 text-xs px-2"
                                  disabled={!!marking}
                                  onClick={() => markPago(p.id)}
                                >
                                  {isMarking ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Marcar pago'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs px-2 text-destructive border-destructive/50 hover:bg-destructive/10"
                                  disabled={!!marking}
                                  onClick={() => markAtrasado(p.id)}
                                >
                                  Atrasar
                                </Button>
                              </>
                            )}
                            {p.status === 'atrasado' && (
                              <Button
                                size="sm"
                                variant="golden"
                                className="h-7 text-xs px-2"
                                disabled={!!marking}
                                onClick={() => markPago(p.id)}
                              >
                                {isMarking ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Marcar pago'}
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filtrados.length > 0 && (
            <div className="px-3 py-2 border-t border-border bg-muted/20 text-right text-xs text-muted-foreground">
              {filtrados.length} registro{filtrados.length !== 1 ? 's' : ''} · Total: R$ {fmt(totalGeral)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminFinanceiro;
