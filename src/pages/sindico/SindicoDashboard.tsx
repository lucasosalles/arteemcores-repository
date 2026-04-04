import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ClipboardList, Clock, CheckCircle2, AlertTriangle, Plus, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SindicoDashboard: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, aguardando: 0, em_andamento: 0, concluidos: 0 });
  const [condo, setCondo] = useState<any>(null);
  const [recentChamados, setRecentChamados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      let { data: condoData } = await supabase
        .from('condominios')
        .select('*')
        .eq('sindico_id', profile?.id)
        .maybeSingle();

      if (!condoData && profile?.id) {
        const { data: newCondo } = await supabase.from('condominios').insert({
          name: 'Meu Condomínio',
          sindico_id: profile.id,
          address: 'Endereço não informado',
          plano: 'essencial',
          limite_atendimentos: 5,
          atendimentos_mes: 0,
          ativo: true
        }).select('*').single();
        condoData = newCondo;
      }

      if (condoData) {
        setCondo(condoData);
        const { data: chamados } = await supabase
          .from('chamados')
          .select('*')
          .eq('condominio_id', condoData.id)
          .order('created_at', { ascending: false });

        if (chamados) {
          const now = new Date();
          const thisMonth = chamados.filter(c => new Date(c.created_at).getMonth() === now.getMonth());
          setStats({
            total: thisMonth.length,
            aguardando: thisMonth.filter(c => c.status === 'aguardando').length,
            em_andamento: thisMonth.filter(c => ['aceito', 'a_caminho', 'em_andamento'].includes(c.status)).length,
            concluidos: thisMonth.filter(c => c.status === 'concluido').length,
          });
          setRecentChamados(chamados.slice(0, 5));
        }
      }
      setLoading(false);
    };
    if (profile?.id) fetchData();
  }, [profile?.id]);

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

  const tipoLabel: Record<string, string> = {
    pintura_interna: '🖌️ Pintura Interna',
    pintura_fachada: '🏗️ Pintura Fachada',
    esquadria: '🪟 Esquadria',
    teto: '🛖 Teto',
    urgencia: '⚡ Urgência',
    outros: '➕ Outros',
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-6">
        {[1,2,3].map(i => (
          <div key={i} className="h-24 bg-card rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Olá, {profile?.full_name?.split(' ')[0]} 👋
          </h1>
          <p className="text-muted-foreground">{condo?.name || 'Seu condomínio'}</p>
        </div>
        <Button variant="golden" onClick={() => navigate('/sindico/chamados?novo=true')}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Chamado
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total do Mês', value: stats.total, icon: <ClipboardList className="w-5 h-5" />, color: 'text-secondary' },
          { label: 'Aguardando', value: stats.aguardando, icon: <Clock className="w-5 h-5" />, color: 'text-warning' },
          { label: 'Em Atendimento', value: stats.em_andamento, icon: <TrendingUp className="w-5 h-5" />, color: 'text-info' },
          { label: 'Concluídos', value: stats.concluidos, icon: <CheckCircle2 className="w-5 h-5" />, color: 'text-success' },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-5">
            <div className={`${stat.color} mb-2`}>{stat.icon}</div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Plan status */}
      {condo && (
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-foreground">Seu Plano</h3>
              <span className="px-3 py-1 rounded-full text-xs font-bold gradient-gold text-secondary-foreground capitalize">
                {condo.plano}
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/sindico/plano')}>
              Ver Plano
            </Button>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Atendimentos este mês</span>
              <span className="text-foreground font-semibold">{condo.atendimentos_mes}/{condo.limite_atendimentos}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full gradient-gold rounded-full transition-all duration-500"
                style={{ width: `${Math.min((condo.atendimentos_mes / condo.limite_atendimentos) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Recent chamados */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-foreground">Chamados Recentes</h3>
          <Button variant="ghost" size="sm" className="text-secondary" onClick={() => navigate('/sindico/chamados')}>
            Ver todos
          </Button>
        </div>
        {recentChamados.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Nenhum chamado ainda. Crie o primeiro!</p>
        ) : (
          <div className="space-y-3">
            {recentChamados.map((chamado) => (
              <div key={chamado.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{tipoLabel[chamado.tipo]?.split(' ')[0] || '📋'}</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      #{String(chamado.numero).padStart(4, '0')} — {chamado.local}
                    </p>
                    <p className="text-xs text-muted-foreground">{tipoLabel[chamado.tipo]?.split(' ').slice(1).join(' ')}</p>
                  </div>
                </div>
                {statusBadge(chamado.status)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SindicoDashboard;
