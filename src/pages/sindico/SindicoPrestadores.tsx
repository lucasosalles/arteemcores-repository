import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, XCircle, Users } from 'lucide-react';

const ESPECIALIDADE_LABEL: Record<string, string> = {
  reparo: 'Reparo', arquitetura: 'Arquitetura', limpeza: 'Limpeza',
  seguranca: 'Segurança', pintura: 'Pintura', eletrica: 'Elétrica',
  hidraulica: 'Hidráulica', jardinagem: 'Jardinagem', outro: 'Outro',
};

const TODAS_ESPECIALIDADES = Object.keys(ESPECIALIDADE_LABEL);

interface Prestador {
  id: string;
  full_name: string;
  phone: string | null;
  disponivel: boolean | null;
  especialidades: string[] | null;
  tempo_medio_execucao_dias: number | null;
  observacao: string | null;
}

export default function SindicoPrestadores() {
  const { profile } = useAuth();
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroDisp, setFiltroDisp] = useState<'todos' | 'disponivel' | 'indisponivel'>('todos');
  const [filtroEsp, setFiltroEsp] = useState('');

  useEffect(() => {
    if (!profile?.id) return;

    const fetch = async () => {
      // Encontra o condomínio do síndico
      const { data: condoData } = await supabase
        .from('condominios')
        .select('id')
        .eq('sindico_id', profile.id)
        .maybeSingle();

      if (!condoData?.id) { setLoading(false); return; }

      // Busca prestadores atribuídos a chamados deste condomínio
      const { data: chamados } = await supabase
        .from('chamados')
        .select('atribuido_para')
        .eq('condominio_id', condoData.id)
        .not('atribuido_para', 'is', null);

      const ids = [...new Set((chamados || []).map((c: any) => c.atribuido_para))];

      if (ids.length === 0) { setLoading(false); return; }

      const [profilesRes, dispRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, phone').in('id', ids),
        supabase.from('disponibilidade_prestador').select('*').in('prestador_id', ids),
      ]);

      const dispMap = new Map((dispRes.data || []).map((d: any) => [d.prestador_id, d]));

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

      lista.sort((a, b) => {
        if (a.disponivel === b.disponivel) return 0;
        return a.disponivel === true ? -1 : 1;
      });

      setPrestadores(lista);
      setLoading(false);
    };

    fetch();
  }, [profile?.id]);

  const filtered = prestadores.filter(p => {
    if (filtroDisp === 'disponivel' && p.disponivel !== true) return false;
    if (filtroDisp === 'indisponivel' && p.disponivel === true) return false;
    if (filtroEsp && !(p.especialidades ?? []).includes(filtroEsp)) return false;
    return true;
  });

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Prestadores</h1>
        <p className="text-muted-foreground">Prestadores vinculados ao seu condomínio</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="flex rounded-xl bg-muted p-1 gap-1">
          {([['todos', 'Todos'], ['disponivel', 'Disponíveis'], ['indisponivel', 'Indisponíveis']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFiltroDisp(val)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                filtroDisp === val ? 'gradient-primary text-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          value={filtroEsp}
          onChange={e => setFiltroEsp(e.target.value)}
          className="px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground"
        >
          <option value="">Todas as especialidades</option>
          {TODAS_ESPECIALIDADES.map(e => (
            <option key={e} value={e}>{ESPECIALIDADE_LABEL[e]}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-36 bg-card rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>{prestadores.length === 0 ? 'Nenhum prestador vinculado a este condomínio.' : 'Nenhum prestador encontrado para os filtros selecionados.'}</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-4 text-muted-foreground font-medium">Nome</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Especialidades</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Disponibilidade</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Tempo médio</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="p-4">
                      <p className="font-semibold text-foreground">{p.full_name}</p>
                      {p.phone && <p className="text-xs text-muted-foreground mt-0.5">{p.phone}</p>}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {(p.especialidades ?? []).length > 0
                          ? p.especialidades!.map(e => (
                              <span key={e} className="px-2 py-0.5 rounded-full text-xs bg-secondary/10 text-secondary border border-secondary/20">
                                {ESPECIALIDADE_LABEL[e] ?? e}
                              </span>
                            ))
                          : <span className="text-muted-foreground text-xs">—</span>
                        }
                      </div>
                    </td>
                    <td className="p-4">
                      {p.disponivel === null ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground">Sem info</span>
                      ) : p.disponivel ? (
                        <span className="flex items-center gap-1 w-fit px-2.5 py-1 rounded-full text-xs font-semibold bg-success/20 text-success">
                          <CheckCircle2 className="w-3 h-3" /> Disponível
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 w-fit px-2.5 py-1 rounded-full text-xs font-semibold bg-muted text-muted-foreground">
                          <XCircle className="w-3 h-3" /> Indisponível
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {p.tempo_medio_execucao_dias
                        ? `${p.tempo_medio_execucao_dias} dia${p.tempo_medio_execucao_dias !== 1 ? 's' : ''}`
                        : '—'
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
