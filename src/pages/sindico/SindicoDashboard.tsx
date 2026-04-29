import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  ClipboardList, FileText, Users, Wrench, Building2, Plus,
} from 'lucide-react';

const STATUS_LABEL: Record<string, string> = {
  aberto: 'Aberto', atribuido: 'Atribuído', aceito: 'Aceito',
  a_caminho: 'A Caminho', em_andamento: 'Em Andamento',
  concluido: 'Concluído', cancelado: 'Cancelado', aguardando: 'Aguardando',
};

const STATUS_CLS: Record<string, string> = {
  aberto: 'bg-warning/20 text-warning', atribuido: 'bg-blue-500/20 text-blue-400',
  aceito: 'bg-blue-500/20 text-blue-400', a_caminho: 'bg-blue-500/20 text-blue-400',
  em_andamento: 'bg-orange-500/20 text-orange-400', concluido: 'bg-success/20 text-success',
  cancelado: 'bg-muted text-muted-foreground',
};

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="glass-card p-5 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

const SindicoDashboard: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [condos, setCondos] = useState<any[]>([]);
  const [selectedCondoId, setSelectedCondoId] = useState<string | 'todos'>('todos');
  const [chamados, setChamados] = useState<any[]>([]);
  const [orcamentos, setOrcamentos] = useState<any[]>([]);
  const [moradores, setMoradores] = useState<any[]>([]);
  const [prestadoresAtivos, setPrestadoresAtivos] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!profile?.id) return;

    const { data: condosData } = await supabase
      .from('condominios')
      .select('id, name')
      .eq('sindico_id', profile.id);

    if (!condosData || condosData.length === 0) { setLoading(false); return; }
    setCondos(condosData);

    const condoIds = condosData.map(c => c.id);

    const [chamRes, orcRes, morRes, presRes] = await Promise.all([
      supabase.from('chamados').select('id, numero, titulo, local, tipo, status, prioridade, data_abertura, created_at, condominio_id')
        .in('condominio_id', condoIds).order('created_at', { ascending: false }).limit(100),
      supabase.from('orcamentos').select('id, titulo, tipo, status, valor_proposto, prazo_dias, data_solicitacao, condominio_id')
        .in('condominio_id', condoIds).order('data_solicitacao', { ascending: false }).limit(100),
      supabase.from('profiles').select('id, condominio_id').in('condominio_id', condoIds),
      supabase.from('disponibilidade_prestador').select('prestador_id').eq('disponivel', true),
    ]);

    setChamados(chamRes.data || []);
    setOrcamentos(orcRes.data || []);
    setMoradores(morRes.data || []);
    setPrestadoresAtivos((presRes.data || []).length);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filterByCondo = <T extends { condominio_id?: string | null }>(items: T[]): T[] => {
    if (selectedCondoId === 'todos') return items;
    return items.filter(i => i.condominio_id === selectedCondoId);
  };

  const filteredChamados = filterByCondo(chamados);
  const filteredOrcamentos = filterByCondo(orcamentos);
  const filteredMoradores = selectedCondoId === 'todos'
    ? moradores
    : moradores.filter(m => m.condominio_id === selectedCondoId);

  const chamadosAbertos = filteredChamados.filter(c =>
    ['aberto', 'atribuido', 'aceito', 'a_caminho', 'em_andamento'].includes(c.status)
  ).length;

  const orcPendentes = filteredOrcamentos.filter(o => o.status === 'em_analise').length;

  const statusCounts: Record<string, number> = {};
  filteredChamados.forEach(c => {
    const label = STATUS_LABEL[c.status] ?? c.status;
    statusCounts[label] = (statusCounts[label] || 0) + 1;
  });
  const chartData = Object.entries(statusCounts).map(([name, count]) => ({ name, count }));

  const chamadosRecentes = filteredChamados.slice(0, 5);
  const orcAguardando = filteredOrcamentos
    .filter(o => o.status === 'em_analise' && o.valor_proposto)
    .slice(0, 5);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-card rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral da sua gestão</p>
        </div>
        {condos.length > 1 && (
          <select
            value={selectedCondoId}
            onChange={e => setSelectedCondoId(e.target.value)}
            className="px-4 py-2 rounded-lg bg-card border border-border text-sm text-foreground"
          >
            <option value="todos">Todos os condomínios</option>
            {condos.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Chamados abertos" value={chamadosAbertos}
          icon={<ClipboardList className="w-5 h-5 text-warning" />} />
        <StatCard label="Orçamentos pendentes" value={orcPendentes}
          icon={<FileText className="w-5 h-5 text-blue-400" />} />
        <StatCard label="Moradores" value={filteredMoradores.length}
          icon={<Users className="w-5 h-5 text-success" />} />
        <StatCard label="Prestadores ativos" value={prestadoresAtivos}
          icon={<Wrench className="w-5 h-5 text-secondary" />} />
      </div>

      {/* Atalhos rápidos */}
      <div className="flex flex-wrap gap-3">
        <Button variant="golden" size="sm" onClick={() => navigate('/sindico/chamados?novo=true')}>
          <Plus className="w-4 h-4 mr-1" /> Novo Chamado
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate('/sindico/orcamentos?novo=true')}>
          <Plus className="w-4 h-4 mr-1" /> Novo Orçamento
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate('/sindico/condominios?novo=true')}>
          <Building2 className="w-4 h-4 mr-1" /> Novo Condomínio
        </Button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Chart chamados por status */}
        <div className="glass-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Chamados por status</h2>
          {chartData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">Sem chamados</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#888' }} />
                <YAxis tick={{ fontSize: 10, fill: '#888' }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
                <Bar dataKey="count" fill="#d4a843" radius={[4, 4, 0, 0]} name="Chamados" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Orçamentos aguardando aprovação */}
        <div className="glass-card p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Aguardando aprovação</h2>
          {orcAguardando.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">Nenhum orçamento aguardando</p>
          ) : (
            <div className="space-y-2">
              {orcAguardando.map(o => (
                <div key={o.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 text-sm cursor-pointer hover:bg-muted/50" onClick={() => navigate('/sindico/orcamentos')}>
                  <div>
                    <p className="font-semibold text-foreground truncate max-w-[180px]">{o.titulo}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.valor_proposto ? `R$ ${o.valor_proposto.toFixed(2)}` : '—'}
                      {o.prazo_dias ? ` · ${o.prazo_dias}d` : ''}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-warning/20 text-warning shrink-0">Em Análise</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Chamados recentes */}
      <div className="glass-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Chamados recentes</h2>
          <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => navigate('/sindico/chamados')}>
            Ver todos →
          </button>
        </div>
        {chamadosRecentes.length === 0 ? (
          <p className="text-center text-muted-foreground py-4 text-sm">Nenhum chamado</p>
        ) : (
          <div className="space-y-2">
            {chamadosRecentes.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 text-sm">
                <div>
                  <p className="font-semibold text-foreground">#{String(c.numero ?? '').padStart(4, '0')} {c.titulo || c.local}</p>
                  <p className="text-xs text-muted-foreground">{new Date(c.data_abertura || c.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 ${STATUS_CLS[c.status] ?? 'bg-muted text-muted-foreground'}`}>
                  {STATUS_LABEL[c.status] ?? c.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SindicoDashboard;
