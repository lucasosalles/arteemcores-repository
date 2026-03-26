import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const TecnicoDisponiveis: React.FC = () => {
  const { profile } = useAuth();
  const [chamados, setChamados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('chamados').select('*, condominios(name)')
        .eq('status', 'aguardando')
        .order('created_at', { ascending: false });
      setChamados(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const tipoLabel: Record<string, string> = {
    pintura_interna: '🖌️ Pintura Interna', pintura_fachada: '🏗️ Pintura Fachada',
    esquadria: '🪟 Esquadria', teto: '🛖 Teto', urgencia: '⚡ Urgência', outros: '➕ Outros',
  };

  if (loading) return <div className="p-6 lg:p-8"><div className="h-64 bg-card rounded-xl animate-pulse" /></div>;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Chamados Disponíveis</h1>
      {chamados.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">Nenhum chamado disponível.</div>
      ) : (
        <div className="space-y-3">
          {chamados.map(c => (
            <div key={c.id} className="glass-card p-4">
              <div className="flex items-center gap-3">
                <span className="text-xl">{tipoLabel[c.tipo]?.split(' ')[0]}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{c.condominios?.name} — {c.local}</p>
                  <p className="text-xs text-muted-foreground">{c.descricao}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TecnicoDisponiveis;
