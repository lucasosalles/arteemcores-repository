import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { CheckCircle2, XCircle, Loader2, ClipboardList, FileText, DollarSign, Star } from 'lucide-react';
import { toast } from 'sonner';

const PRIO_ORDER: Record<string, number> = { urgente: 0, alta: 0, media: 1, normal: 2, baixa: 3 };

const STATUS_LABEL: Record<string, string> = {
  aberto: 'Aberto', atribuido: 'Atribuído', aceito: 'Aceito',
  a_caminho: 'A Caminho', em_andamento: 'Em Andamento',
  concluido: 'Concluído', cancelado: 'Cancelado',
};

const TIPO_EMOJI: Record<string, string> = {
  reparo: '🔧', arquitetura: '🏛️', limpeza: '🧹', seguranca: '🔒',
  pintura: '🖌️', eletrica: '⚡', hidraulica: '🚿', jardinagem: '🌿', outro: '➕',
};

function StatCard({ label, value, icon, accent = false }: { label: string; value: string | number; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`glass-card p-5 flex items-center gap-4 ${accent ? 'border-secondary/40' : ''}`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${accent ? 'bg-secondary/20' : 'bg-muted'}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export default function PrestadorDashboard() {
  const { profile } = useAuth();

  const [chamados, setChamados] = useState<any[]>([]);
  const [orcamentos, setOrcamentos] = useState<any[]>([]);
  const [faturamento, setFaturamento] = useState(0);
  const [disponivel, setDisponivel] = useState<boolean | null>(null);
  const [dispId, setDispId] = useState<string | null>(null);
  const [togglingDisp, setTogglingDisp] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!profile?.id) return;

    const now = new Date();
    const mesStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [chamRes, orcRes, pagRes, dispRes] = await Promise.all([
      supabase.from('chamados').select('id, status, tipo, prioridade, titulo, local, data_abertura, concluded_at')
        .eq('atribuido_para', profile.id),
      supabase.from('orcamentos').select('id, status, titulo, tipo, data_solicitacao, valor_proposto, prazo_dias')
        .or(`prestador_id.eq.${profile.id},and(status.eq.enviado,prestador_id.is.null)`),
      supabase.from('pagamentos_simulados').select('valor, data_pagamento')
        .eq('prestador_id', profile.id).eq('status', 'pago')
        .gte('data_pagamento', mesStart.split('T')[0]),
      supabase.from('disponibilidade_prestador').select('id, disponivel')
        .eq('prestador_id', profile.id).maybeSingle(),
    ]);

    setChamados(chamRes.data || []);
    setOrcamentos(orcRes.data || []);
    setFaturamento((pagRes.data || []).reduce((s: number, p: any) => s + (p.valor || 0), 0));
    setDisponivel(dispRes.data?.disponivel ?? null);
    setDispId(dispRes.data?.id ?? null);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleDisponibilidade = async () => {
    if (!profile?.id) return;
    setTogglingDisp(true);
    const novoDisp = !disponivel;

    if (dispId) {
      const { error } = await supabase.from('disponibilidade_prestador')
        .update({ disponivel: novoDisp }).eq('id', dispId);
      if (error) { toast.error(error.message); setTogglingDisp(false); return; }
    } else {
      const { data, error } = await supabase.from('disponibilidade_prestador')
        .insert({ prestador_id: profile.id, disponivel: novoDisp, especialidades: [] })
        .select('id').single();
      if (error) { toast.error(error.message); setTogglingDisp(false); return; }
      setDispId(data.id);
    }

    setDisponivel(novoDisp);
    toast.success(novoDisp ? 'Você está disponível' : 'Você está indisponível');
    setTogglingDisp(false);
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-card rounded-xl animate-pulse" />)}
      </div>
    );
  }

  // ─── Stats ────────────────────────────────────────────────────────────────────
  const now = new Date();
  const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const chamadosAtivos = chamados.filter(c =>
    ['atribuido', 'aceito', 'a_caminho', 'em_andamento'].includes(c.status)
  ).length;

  const orcPendentes = orcamentos.filter(o =>
    o.status === 'enviado'
  ).length;

  const orcEmExecucao = orcamentos.filter(o => o.status === 'em_execucao').length;

  const concluidosMes = [
    ...chamados.filter(c => c.status === 'concluido' && (c.concluded_at || '').startsWith(mesAtual)),
    ...orcamentos.filter(o => o.status === 'concluido' && (o.data_solicitacao || '').startsWith(mesAtual)),
  ].length;

  // ─── Chart: chamados por status ───────────────────────────────────────────────
  const statusCounts: Record<string, number> = {};
  chamados.forEach(c => {
    const label = STATUS_LABEL[c.status] ?? c.status;
    statusCounts[label] = (statusCounts[label] || 0) + 1;
  });
  const statusChartData = Object.entries(statusCounts).map(([name, count]) => ({ name, count }));

  // ─── Chart: orçamentos por mês (últimos 6) ────────────────────────────────────
  const monthsData: { name: string; key: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthsData.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      name: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
    });
  }
  const orcChartData = monthsData.map(m => ({
    name: m.name,
    orcamentos: orcamentos.filter(o =>
      (o.data_solicitacao || '').startsWith(m.key) && o.status !== 'cancelado'
    ).length,
  }));

  // ─── Próximos serviços ────────────────────────────────────────────────────────
  const proximosServicos = chamados
    .filter(c => c.status === 'em_andamento')
    .sort((a, b) => {
      const pa = PRIO_ORDER[a.prioridade] ?? 2;
      const pb = PRIO_ORDER[b.prioridade] ?? 2;
      return pa !== pb ? pa - pb : new Date(a.data_abertura || a.created_at).getTime() - new Date(b.data_abertura || b.created_at).getTime();
    })
    .slice(0, 5);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header + disponibilidade */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Bem-vindo, {profile?.full_name?.split(' ')[0]}</p>
        </div>
        <button
          onClick={toggleDisponibilidade}
          disabled={togglingDisp}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all text-sm font-semibold ${
            disponivel === true
              ? 'border-success bg-success/10 text-success'
              : disponivel === false
              ? 'border-destructive bg-destructive/10 text-destructive'
              : 'border-border text-muted-foreground'
          }`}
        >
          {togglingDisp ? <Loader2 className="w-4 h-4 animate-spin" /> :
            disponivel ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />
          }
          {disponivel === null ? 'Definir disponibilidade' : disponivel ? 'Disponível' : 'Indisponível'}
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard label="Chamados ativos" value={chamadosAtivos}
          icon={<ClipboardList className="w-5 h-5 text-blue-400" />} />
        <StatCard label="Orçamentos disponíveis" value={orcPendentes}
          icon={<FileText className="w-5 h-5 text-warning" />} />
        <StatCard label="Em execução" value={orcEmExecucao}
          icon={<FileText className="w-5 h-5 text-purple-400" />} />
        <StatCard label="Concluídos no mês" value={concluidosMes}
          icon={<Star className="w-5 h-5 text-success" />} />
        <StatCard label="Faturamento do mês" value={`R$ ${faturamento.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={<DollarSign className="w-5 h-5 text-secondary" />} accent />
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Chamados por status */}
        <div className="glass-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Chamados por status</h2>
          {statusChartData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">Sem chamados ainda</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={statusChartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888' }} />
                <YAxis tick={{ fontSize: 11, fill: '#888' }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
                <Bar dataKey="count" fill="#d4a843" radius={[4, 4, 0, 0]} name="Chamados" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Orçamentos por mês */}
        <div className="glass-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Orçamentos — últimos 6 meses</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={orcChartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#888' }} />
              <YAxis tick={{ fontSize: 11, fill: '#888' }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
              <Line type="monotone" dataKey="orcamentos" stroke="#d4a843" strokeWidth={2} dot={{ r: 3 }} name="Orçamentos" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Próximos serviços */}
      <div className="glass-card p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Serviços em andamento</h2>
        {proximosServicos.length === 0 ? (
          <p className="text-center text-muted-foreground py-6 text-sm">Nenhum serviço em andamento</p>
        ) : (
          <div className="space-y-2">
            {proximosServicos.map(c => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                <span className="text-xl">{TIPO_EMOJI[c.tipo] ?? '📋'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{c.titulo || c.local}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.local && `${c.local} · `}
                    {new Date(c.data_abertura || c.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-semibold whitespace-nowrap">
                  Em Andamento
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
