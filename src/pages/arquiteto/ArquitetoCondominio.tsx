import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Building2, MapPin, User, Phone, BarChart3 } from 'lucide-react';

const PLANO_CONFIG: Record<string, { label: string; cls: string }> = {
  essencial:    { label: 'Essencial',    cls: 'bg-muted text-muted-foreground' },
  profissional: { label: 'Profissional', cls: 'bg-blue-500/20 text-blue-400' },
  premium:      { label: 'Premium',      cls: 'bg-secondary/20 text-secondary' },
};

export default function ArquitetoCondominio() {
  const { profile } = useAuth();
  const [condo, setCondo] = useState<any>(null);
  const [sindico, setSindico] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;

    const fetchCondo = async () => {
      // Descobre o condomínio do arquiteto via chamados atribuídos
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
        .select('*')
        .eq('id', ref.condominio_id)
        .single();

      if (condoData) {
        setCondo(condoData);

        if (condoData.sindico_id) {
          const { data: sindicoData } = await supabase
            .from('profiles')
            .select('full_name, phone')
            .eq('id', condoData.sindico_id)
            .maybeSingle();
          setSindico(sindicoData);
        }
      }

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
        <h1 className="text-2xl font-bold text-foreground mb-4">Condomínio</h1>
        <div className="glass-card p-12 text-center text-muted-foreground">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>Você ainda não está vinculado a nenhum condomínio.</p>
          <p className="text-xs mt-1">Contate o administrador para ser atribuído.</p>
        </div>
      </div>
    );
  }

  const plano = PLANO_CONFIG[condo.plano] ?? { label: condo.plano, cls: 'bg-muted text-muted-foreground' };
  const usoPercent = condo.limite_atendimentos > 0
    ? Math.min(100, Math.round((condo.atendimentos_mes / condo.limite_atendimentos) * 100))
    : 0;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Condomínio</h1>
        <p className="text-muted-foreground">Informações do seu condomínio</p>
      </div>

      {/* Identidade */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-secondary" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{condo.name}</p>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${plano.cls}`}>
                {plano.label}
              </span>
            </div>
          </div>
        </div>

        {condo.address && (
          <div className="flex items-start gap-3 text-sm">
            <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <span className="text-muted-foreground">{condo.address}</span>
          </div>
        )}
      </div>

      {/* Síndico */}
      {sindico && (
        <div className="glass-card p-6 space-y-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Síndico</h2>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
              {sindico.full_name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div>
              <p className="font-semibold text-foreground">{sindico.full_name}</p>
              {sindico.phone && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Phone className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{sindico.phone}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Uso do plano */}
      <div className="glass-card p-6 space-y-3">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          Uso do Plano — Mês Atual
        </h2>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Atendimentos</span>
          <span className={`font-semibold ${usoPercent >= 100 ? 'text-destructive' : 'text-foreground'}`}>
            {condo.atendimentos_mes ?? 0} / {condo.limite_atendimentos ?? '—'}
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${usoPercent >= 100 ? 'bg-destructive' : 'bg-secondary'}`}
            style={{ width: `${usoPercent}%` }}
          />
        </div>
        {usoPercent >= 100 && (
          <p className="text-xs text-destructive">
            Limite atingido — novos chamados geram orçamento de serviço extra.
          </p>
        )}
      </div>
    </div>
  );
}
