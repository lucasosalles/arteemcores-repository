import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { FileText, Users, CheckCircle2, DollarSign, Clock, Plus } from 'lucide-react';

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho', enviado: 'Enviado', em_analise: 'Em análise',
  aprovado: 'Aprovado', recusado: 'Recusado', em_execucao: 'Em execução',
  concluido: 'Concluído', cancelado: 'Cancelado',
};

const PIE_COLORS: Record<string, string> = {
  Enviado: '#3b82f6', 'Em análise': '#d4a843', Aprovado: '#22c55e',
  'Em execução': '#f97316', Concluído: '#10b981', Recusado: '#6b7280', Cancelado: '#6b7280',
};

function StatCard({ label, value, icon, sub }: { label: string; value: string | number; icon: React.ReactNode; sub?: string }) {
  return (
    <div className="glass-card p-5 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
        {sub && <p className="text-xs text-muted-foreground/70">{sub}</p>}
      </div>
    </div>
  );
}

const MONTH_NAMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

export default function ArquitetoDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [orcamentos, setOrcamentos] = useState<any[]>([]);
  const [prestadores, setPrestadores] = useState<any[]>([]);
  const [faturamento, setFaturamento] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!profile?.id) return;

    const [orcRes, presRes, pagRes] = await Promise.all([
      supabase.rpc('get_arquiteto_orcamentos', { p_arquiteto_id: profile.id }),
      supabase.rpc('get_prestadores_do_arquiteto', { p_arquiteto_id: profile.id }),
      supabase.from('pagamentos_simulados')
        .select('valor, status, data_pagamento')
        .eq('solicitante_id', profile.id)
        .eq('status', 'pago'),
    ]);

    const orcs: any[] = orcRes.data || [];
    setOrcamentos(orcs);
    setPrestadores(presRes.data || []);

    const now = new Date();
    const fatMes = (pagRes.data || [])
      .filter((p: any) => {
        const d = new Date(p.data_pagamento || '');
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      })
      .reduce((s: number, p: any) => s + (p.valor || 0), 0);
    setFaturamento(fatMes);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const now = new Date();

  const pendentes    = orcamentos.filter(o => ['enviado', 'em_analise'].includes(o.status));
  const emExecucao   = orcamentos.filter(o => o.status === 'em_execucao');
  const concluidosMes = orcamentos.filter(o => {
    if (o.status !== 'concluido' || !o.data_conclusao) return false;
    const d = new Date(o.data_conclusao);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const clientesUnicos = new Set(orcamentos.map(o => o.condominio_id).filter(Boolean)).size;

  // Pizza — orçamentos por status
  const statusCounts: Record<string, number> = {};
  orcamentos.forEach(o => {
    const lbl = STATUS_LABEL[o.status] ?? o.status;
    statusCounts[lbl] = (statusCounts[lbl] || 0) + 1;
  });
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // Linha — últimos 6 meses
  const lineData = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const cnt = orcamentos.filter(o => {
      const od = new Date(o.created_at);
      return od.getFullYear() === d.getFullYear() && od.getMonth() === d.getMonth();
    }).length;
    return { mes: MONTH_NAMES[d.getMonth()], total: cnt };
  });

  // Prestadores em execução agora
  const prestExec = emExecucao.map(o => ({
    ...o,
    prestador: prestadores.find((p: any) => p.prestador_id === o.prestador_id),
  })).filter(o => o.prestador);

  // Clientes recentes
  const clientesRecentes: { id: string; name: string; ultimo: string }[] = [];
  const seen = new Set<string>();
  for (const o of orcamentos) {
    if (o.condominio_id && o.condominio_name && !seen.has(o.condominio_id)) {
      seen.add(o.condominio_id);
      clientesRecentes.push({ id: o.condominio_id, name: o.condominio_name, ultimo: o.data_solicitacao });
      if (clientesRecentes.length >= 5) break;
    }
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-card rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral dos seus projetos</p>
        </div>
        <Button variant="golden" size="sm" onClick={() => navigate('/arquiteto/orcamentos?novo=true')}>
          <Plus className="w-4 h-4 mr-1" /> Novo Orçamento
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Aguardando resposta" value={pendentes.length}     icon={<Clock className="w-5 h-5 text-warning" />} />
        <StatCard label="Em execução"         value={emExecucao.length}    icon={<FileText className="w-5 h-5 text-orange-400" />} />
        <StatCard label="Concluídos no mês"   value={concluidosMes.length} icon={<CheckCircle2 className="w-5 h-5 text-success" />} />
        <StatCard label="Clientes ativos"     value={clientesUnicos}       icon={<Users className="w-5 h-5 text-blue-400" />} />
        <StatCard label="Faturamento mês"     value={`R$ ${faturamento.toFixed(2)}`} icon={<DollarSign className="w-5 h-5 text-secondary" />} sub="pagamentos confirmados" />
      </div>

      {/* Gráficos */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="glass-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Orçamentos por status</h2>
          {pieData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={PIE_COLORS[entry.name] ?? '#888'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }}
                  formatter={(v: any, name: any) => [v, name]} />
              </PieChart>
            </ResponsiveContainer>
          )}
          {pieData.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {pieData.map(e => (
                <span key={e.name} className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: PIE_COLORS[e.name] ?? '#888' }} />
                  {e.name} ({e.value})
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Orçamentos — últimos 6 meses</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={lineData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#888' }} />
              <YAxis tick={{ fontSize: 11, fill: '#888' }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
              <Line type="monotone" dataKey="total" stroke="#d4a843" strokeWidth={2} dot={{ fill: '#d4a843' }} name="Orçamentos" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Prestadores em execução */}
        <div className="glass-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Prestadores em execução</h2>
          {prestExec.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">Nenhum serviço em execução no momento.</p>
          ) : (
            <div className="space-y-2">
              {prestExec.slice(0, 5).map(o => (
                <div key={o.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 text-sm">
                  <div>
                    <p className="font-semibold text-foreground">{o.prestador.full_name}</p>
                    <p className="text-xs text-muted-foreground">{o.titulo}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-400 shrink-0">Em execução</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Aguardando aprovação */}
        <div className="glass-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Aguardando aprovação</h2>
          {pendentes.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">Nenhum orçamento pendente.</p>
          ) : (
            <div className="space-y-2">
              {pendentes.slice(0, 5).map(o => (
                <div key={o.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 text-sm cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate('/arquiteto/orcamentos')}>
                  <div>
                    <p className="font-semibold text-foreground truncate max-w-[180px]">{o.titulo}</p>
                    <p className="text-xs text-muted-foreground">{o.prestador_name ?? '—'}</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-warning/20 text-warning shrink-0">
                    {STATUS_LABEL[o.status]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Clientes recentes */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Clientes recentes</h2>
          <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => navigate('/arquiteto/clientes')}>
            Ver todos →
          </button>
        </div>
        {clientesRecentes.length === 0 ? (
          <p className="text-center text-muted-foreground py-4 text-sm">Nenhum cliente ainda.</p>
        ) : (
          <div className="space-y-2">
            {clientesRecentes.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 text-sm">
                <p className="font-semibold text-foreground">{c.name}</p>
                <p className="text-xs text-muted-foreground">{new Date(c.ultimo).toLocaleDateString('pt-BR')}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
