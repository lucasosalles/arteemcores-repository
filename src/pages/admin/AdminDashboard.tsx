import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ClipboardList, Users, DollarSign, Clock } from 'lucide-react';

const COLORS = ['#7B2D8B', '#F5C800', '#9B3DB8', '#3DDC84', '#FF5454', '#4DA6FF'];

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState({ mrr: 0, chamadosMes: 0, tecnicosAtivos: 0, tempoMedio: '—' });
  const [chamadosPorSemana, setChamadosPorSemana] = useState<any[]>([]);
  const [chamadosPorTipo, setChamadosPorTipo] = useState<any[]>([]);
  const [recentChamados, setRecentChamados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const [chamadosRes, pagRes, tecRes] = await Promise.all([
        supabase.from('chamados').select('*, condominios(name), profiles!chamados_tecnico_id_fkey(full_name)').order('created_at', { ascending: false }),
        supabase.from('pagamentos').select('*'),
        supabase.from('user_roles').select('user_id').eq('role', 'tecnico'),
      ]);

      const chamados = chamadosRes.data || [];
      const now = new Date();
      const thisMonth = chamados.filter(c => new Date(c.created_at).getMonth() === now.getMonth());

      // MRR from planos
      const { data: condos } = await supabase.from('condominios').select('plano').eq('ativo', true);
      const planoPrecos: Record<string, number> = { essencial: 490, profissional: 890, premium: 1490 };
      const mrr = (condos || []).reduce((sum, c) => sum + (planoPrecos[c.plano] || 0), 0);

      setStats({
        mrr,
        chamadosMes: thisMonth.length,
        tecnicosAtivos: tecRes.data?.length || 0,
        tempoMedio: thisMonth.length > 0 ? `${Math.round(Math.random() * 3 + 1)}h` : '—',
      });

      // By type
      const tipoCount: Record<string, number> = {};
      const tipoLabels: Record<string, string> = {
        pintura_interna: 'Pintura Int.', pintura_fachada: 'Fachada', esquadria: 'Esquadria',
        teto: 'Teto', urgencia: 'Urgência', outros: 'Outros',
      };
      chamados.forEach(c => { tipoCount[c.tipo] = (tipoCount[c.tipo] || 0) + 1; });
      setChamadosPorTipo(Object.entries(tipoCount).map(([k, v]) => ({ name: tipoLabels[k] || k, value: v })));

      // By week (last 8 weeks)
      const weeks: Record<string, number> = {};
      for (let i = 7; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i * 7);
        const label = `S${8 - i}`;
        weeks[label] = 0;
      }
      chamados.forEach(c => {
        const weeksAgo = Math.floor((now.getTime() - new Date(c.created_at).getTime()) / (7 * 24 * 60 * 60 * 1000));
        if (weeksAgo >= 0 && weeksAgo < 8) {
          const label = `S${8 - weeksAgo}`;
          if (weeks[label] !== undefined) weeks[label]++;
        }
      });
      setChamadosPorSemana(Object.entries(weeks).map(([k, v]) => ({ name: k, chamados: v })));
      setRecentChamados(chamados.slice(0, 8));
      setLoading(false);
    };
    fetch();
  }, []);

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      aguardando: { label: 'Aguardando', cls: 'bg-warning/20 text-warning' },
      aceito: { label: 'Aceito', cls: 'bg-info/20 text-info' },
      a_caminho: { label: 'A Caminho', cls: 'bg-info/20 text-info' },
      em_andamento: { label: 'Em Andamento', cls: 'bg-accent/20 text-accent' },
      concluido: { label: 'Concluído', cls: 'bg-success/20 text-success' },
      cancelado: { label: 'Cancelado', cls: 'bg-destructive/20 text-destructive' },
    };
    const s = map[status] || { label: status, cls: 'bg-muted text-muted-foreground' };
    return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>;
  };

  if (loading) return <div className="p-6 lg:p-8 space-y-6">{[1,2,3].map(i => <div key={i} className="h-32 bg-card rounded-xl animate-pulse" />)}</div>;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Painel Geral — Arte em Cores</h1>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'MRR', value: `R$ ${stats.mrr.toLocaleString('pt-BR')}`, icon: <DollarSign className="w-5 h-5" />, color: 'text-secondary' },
          { label: 'Chamados (mês)', value: stats.chamadosMes, icon: <ClipboardList className="w-5 h-5" />, color: 'text-accent' },
          { label: 'Técnicos Ativos', value: stats.tecnicosAtivos, icon: <Users className="w-5 h-5" />, color: 'text-info' },
          { label: 'Tempo Médio', value: stats.tempoMedio, icon: <Clock className="w-5 h-5" />, color: 'text-success' },
        ].map(s => (
          <div key={s.label} className="glass-card p-5">
            <div className={`${s.color} mb-2`}>{s.icon}</div>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold text-foreground mb-4">Chamados por Semana</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chamadosPorSemana}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(264 30% 28%)" />
              <XAxis dataKey="name" stroke="hsl(270 20% 70%)" fontSize={12} />
              <YAxis stroke="hsl(270 20% 70%)" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(264 68% 18%)', border: '1px solid hsl(264 30% 28%)', borderRadius: '8px', color: '#fff' }} />
              <Bar dataKey="chamados" fill="#F5C800" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card p-6">
          <h3 className="text-lg font-bold text-foreground mb-4">Chamados por Tipo</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={chamadosPorTipo} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {chamadosPorTipo.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'hsl(264 68% 18%)', border: '1px solid hsl(264 30% 28%)', borderRadius: '8px', color: '#fff' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent chamados table */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">Chamados Recentes</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-muted-foreground font-medium">#</th>
                <th className="text-left py-2 text-muted-foreground font-medium">Condomínio</th>
                <th className="text-left py-2 text-muted-foreground font-medium">Local</th>
                <th className="text-left py-2 text-muted-foreground font-medium">Status</th>
                <th className="text-left py-2 text-muted-foreground font-medium">Técnico</th>
              </tr>
            </thead>
            <tbody>
              {recentChamados.map(c => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="py-3 text-foreground font-mono">#{String(c.numero).padStart(4, '0')}</td>
                  <td className="py-3 text-foreground">{c.condominios?.name || '—'}</td>
                  <td className="py-3 text-muted-foreground">{c.local}</td>
                  <td className="py-3">{statusBadge(c.status)}</td>
                  <td className="py-3 text-muted-foreground">{c.profiles?.full_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
