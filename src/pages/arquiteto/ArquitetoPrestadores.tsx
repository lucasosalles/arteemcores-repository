import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, XCircle } from 'lucide-react';

const ESPECIALIDADE_LABEL: Record<string, string> = {
  reparo: 'Reparo', arquitetura: 'Arquitetura', limpeza: 'Limpeza',
  seguranca: 'Segurança', pintura: 'Pintura', eletrica: 'Elétrica',
  hidraulica: 'Hidráulica', jardinagem: 'Jardinagem', outro: 'Outro',
};

interface Prestador {
  id: string;
  full_name: string;
  phone: string | null;
  disponivel: boolean | null;
  especialidades: string[] | null;
  tempo_medio_execucao_dias: number | null;
  observacao: string | null;
}

export default function ArquitetoPrestadores() {
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrestadores = async () => {
      // Busca todos os usuários com role prestador ou tecnico
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['prestador', 'tecnico']);

      if (!roles || roles.length === 0) {
        setLoading(false);
        return;
      }

      const ids = roles.map(r => r.user_id);

      // Busca perfis + disponibilidade em paralelo
      const [profilesRes, dispRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, phone').in('id', ids),
        supabase.from('disponibilidade_prestador').select('*').in('prestador_id', ids),
      ]);

      const dispMap = new Map(
        (dispRes.data || []).map((d: any) => [d.prestador_id, d]),
      );

      const lista: Prestador[] = (profilesRes.data || []).map((p: any) => {
        const disp = dispMap.get(p.id);
        return {
          id: p.id,
          full_name: p.full_name,
          phone: p.phone,
          disponivel: disp?.disponivel ?? null,
          especialidades: disp?.especialidades ?? null,
          tempo_medio_execucao_dias: disp?.tempo_medio_execucao_dias ?? null,
          observacao: disp?.observacao ?? null,
        };
      });

      // Disponíveis primeiro
      lista.sort((a, b) => {
        if (a.disponivel === b.disponivel) return 0;
        if (a.disponivel === true) return -1;
        return 1;
      });

      setPrestadores(lista);
      setLoading(false);
    };

    fetchPrestadores();
  }, []);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Prestadores</h1>
        <p className="text-muted-foreground">Prestadores cadastrados e suas disponibilidades</p>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-36 bg-card rounded-xl animate-pulse" />)}
        </div>
      ) : prestadores.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">
          Nenhum prestador cadastrado ainda.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {prestadores.map(p => (
            <div key={p.id} className="glass-card p-5 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-foreground">{p.full_name}</p>
                  {p.phone && (
                    <p className="text-xs text-muted-foreground mt-0.5">{p.phone}</p>
                  )}
                </div>
                {p.disponivel === null ? (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
                    Sem info
                  </span>
                ) : p.disponivel ? (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-success/20 text-success">
                    <CheckCircle2 className="w-3 h-3" /> Disponível
                  </span>
                ) : (
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
                    <XCircle className="w-3 h-3" /> Indisponível
                  </span>
                )}
              </div>

              {/* Especialidades */}
              {p.especialidades && p.especialidades.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {p.especialidades.map(e => (
                    <span
                      key={e}
                      className="px-2 py-0.5 rounded-full text-xs bg-secondary/10 text-secondary border border-secondary/20"
                    >
                      {ESPECIALIDADE_LABEL[e] ?? e}
                    </span>
                  ))}
                </div>
              )}

              {/* Tempo médio */}
              {p.tempo_medio_execucao_dias && (
                <p className="text-xs text-muted-foreground">
                  Tempo médio: <span className="text-foreground font-medium">{p.tempo_medio_execucao_dias} dia{p.tempo_medio_execucao_dias !== 1 ? 's' : ''}</span>
                </p>
              )}

              {/* Observação */}
              {p.observacao && (
                <p className="text-xs text-muted-foreground line-clamp-2 italic">"{p.observacao}"</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
