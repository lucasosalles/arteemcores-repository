import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SindicoPlano: React.FC = () => {
  const [planos, setPlanos] = useState<any[]>([]);
  const [condo, setCondo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const [planosRes, condoRes] = await Promise.all([
        supabase.from('planos').select('*'),
        supabase.from('condominios').select('*').eq('sindico_id', user.id).single(),
      ]);
      setPlanos(planosRes.data || []);
      setCondo(condoRes.data);
      setLoading(false);
    };
    fetch();
  }, []);

  const order = ['essencial', 'profissional', 'premium'];

  if (loading) return <div className="p-6 lg:p-8"><div className="h-64 bg-card rounded-xl animate-pulse" /></div>;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Meu Plano</h1>

      {condo && (
        <div className="glass-card p-6 space-y-3">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-xs font-bold gradient-gold text-secondary-foreground capitalize">{condo.plano}</span>
            <span className="text-foreground font-semibold">{condo.name}</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Atendimentos este mês</span>
              <span className="text-foreground font-semibold">{condo.atendimentos_mes}/{condo.limite_atendimentos}</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div className="h-full gradient-gold rounded-full transition-all duration-500"
                style={{ width: `${Math.min((condo.atendimentos_mes / condo.limite_atendimentos) * 100, 100)}%` }} />
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {planos.sort((a, b) => order.indexOf(a.nome) - order.indexOf(b.nome)).map(plano => {
          const isCurrent = condo?.plano === plano.nome;
          return (
            <div key={plano.id} className={`glass-card p-6 space-y-4 relative ${isCurrent ? 'ring-2 ring-secondary glow-secondary' : ''}`}>
              {isCurrent && <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold gradient-gold text-secondary-foreground">Atual</div>}
              <h3 className="text-lg font-bold text-foreground capitalize">{plano.nome}</h3>
              <p className="text-3xl font-extrabold text-foreground">
                R$ {Number(plano.preco).toLocaleString('pt-BR')}
                <span className="text-sm font-normal text-muted-foreground">/mês</span>
              </p>
              <ul className="space-y-2">
                {(plano.descricao as string[])?.map((desc: string, i: number) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-success mt-0.5">✓</span> {desc}
                  </li>
                ))}
              </ul>
              {!isCurrent && (
                <a href="https://wa.me/5511999999999?text=Quero%20upgrade%20de%20plano" target="_blank" rel="noopener noreferrer">
                  <button className="w-full mt-2 py-2 rounded-lg border border-secondary text-secondary text-sm font-semibold hover:bg-secondary/10 transition-colors">
                    Fazer Upgrade
                  </button>
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SindicoPlano;
