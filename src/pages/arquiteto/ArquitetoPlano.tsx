import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, XCircle, Building2 } from 'lucide-react';

const PLANO_CONFIG: Record<string, { label: string; cls: string; headerCls: string }> = {
  essencial:    { label: 'Essencial',    cls: 'bg-muted text-muted-foreground',     headerCls: 'bg-muted/50' },
  profissional: { label: 'Profissional', cls: 'bg-blue-500/20 text-blue-400',       headerCls: 'bg-blue-500/10' },
  premium:      { label: 'Premium',      cls: 'bg-secondary/20 text-secondary',     headerCls: 'bg-secondary/10' },
};

interface Feature {
  label: string;
  essencial: boolean;
  profissional: boolean;
  premium: boolean;
}

const FEATURES: Feature[] = [
  { label: 'Abertura de chamados',            essencial: true,  profissional: true,  premium: true  },
  { label: 'Painel do síndico',               essencial: true,  profissional: true,  premium: true  },
  { label: 'Gestão de moradores',             essencial: true,  profissional: true,  premium: true  },
  { label: 'Histórico de chamados',           essencial: true,  profissional: true,  premium: true  },
  { label: 'Gestão de prestadores',           essencial: false, profissional: true,  premium: true  },
  { label: 'Orçamentos e aprovações',         essencial: false, profissional: true,  premium: true  },
  { label: 'Notificações por e-mail',         essencial: false, profissional: true,  premium: true  },
  { label: 'Painel arquiteto',                essencial: false, profissional: true,  premium: true  },
  { label: 'Relatórios financeiros',          essencial: false, profissional: false, premium: true  },
  { label: 'Atendimentos ilimitados',         essencial: false, profissional: false, premium: true  },
  { label: 'Suporte prioritário',             essencial: false, profissional: false, premium: true  },
  { label: 'API de integração',               essencial: false, profissional: false, premium: true  },
];

const LIMITES: Record<string, string> = {
  essencial:    '10 atendimentos/mês',
  profissional: '50 atendimentos/mês',
  premium:      'Ilimitado',
};

export default function ArquitetoPlano() {
  const { profile } = useAuth();
  const [condo, setCondo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;

    const fetchCondo = async () => {
      const { data: ref } = await supabase
        .from('chamados')
        .select('condominio_id')
        .eq('atribuido_para', profile.id)
        .limit(1)
        .maybeSingle();

      if (!ref?.condominio_id) {
        setLoading(false);
        return;
      }

      const { data: condoData } = await supabase
        .from('condominios')
        .select('name, plano, atendimentos_mes, limite_atendimentos')
        .eq('id', ref.condominio_id)
        .single();

      if (condoData) setCondo(condoData);
      setLoading(false);
    };

    fetchCondo();
  }, [profile?.id]);

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-card rounded-xl animate-pulse" />)}
      </div>
    );
  }

  if (!condo) {
    return (
      <div className="p-6 lg:p-8">
        <h1 className="text-2xl font-bold text-foreground mb-4">Meu Plano</h1>
        <div className="glass-card p-12 text-center text-muted-foreground">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Você ainda não está vinculado a nenhum condomínio.</p>
        </div>
      </div>
    );
  }

  const planoKey = condo.plano ?? 'essencial';
  const plano = PLANO_CONFIG[planoKey] ?? PLANO_CONFIG.essencial;
  const usoPercent = condo.limite_atendimentos > 0
    ? Math.min(100, Math.round((condo.atendimentos_mes / condo.limite_atendimentos) * 100))
    : 0;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meu Plano</h1>
        <p className="text-muted-foreground">Plano atual do condomínio {condo.name}</p>
      </div>

      {/* Plan badge */}
      <div className={`glass-card p-6 flex items-center justify-between ${plano.headerCls}`}>
        <div>
          <p className="text-sm text-muted-foreground uppercase tracking-wide font-semibold">Plano Atual</p>
          <p className="text-3xl font-bold text-foreground mt-1">{plano.label}</p>
          <p className="text-sm text-muted-foreground mt-1">{LIMITES[planoKey]}</p>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${plano.cls}`}>
          {plano.label}
        </span>
      </div>

      {/* Usage */}
      {condo.limite_atendimentos > 0 && (
        <div className="glass-card p-6 space-y-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Uso — Mês Atual</h2>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Atendimentos</span>
            <span className={`font-semibold ${usoPercent >= 100 ? 'text-destructive' : 'text-foreground'}`}>
              {condo.atendimentos_mes ?? 0} / {condo.limite_atendimentos}
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${usoPercent >= 100 ? 'bg-destructive' : 'bg-secondary'}`}
              style={{ width: `${usoPercent}%` }}
            />
          </div>
          {usoPercent >= 100 && (
            <p className="text-xs text-destructive">Limite atingido — chamados adicionais geram orçamento de serviço extra.</p>
          )}
        </div>
      )}

      {/* Feature table */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Recursos incluídos</h2>
        </div>
        <div className="divide-y divide-border/50">
          {FEATURES.map(f => {
            const included = f[planoKey as keyof Feature] as boolean;
            return (
              <div key={f.label} className="flex items-center justify-between px-6 py-3">
                <span className={`text-sm ${included ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                  {f.label}
                </span>
                {included
                  ? <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                  : <XCircle className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                }
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
