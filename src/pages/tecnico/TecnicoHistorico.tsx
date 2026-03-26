import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const TecnicoHistorico: React.FC = () => {
  const { profile } = useAuth();
  const [chamados, setChamados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (!profile?.id) return;
      const { data } = await supabase.from('chamados').select('*, condominios(name)')
        .eq('tecnico_id', profile.id).eq('status', 'concluido')
        .order('concluded_at', { ascending: false });
      setChamados(data || []);
      setLoading(false);
    };
    fetch();
  }, [profile?.id]);

  const tipoLabel: Record<string, string> = {
    pintura_interna: '🖌️ Pintura Interna', pintura_fachada: '🏗️ Pintura Fachada',
    esquadria: '🪟 Esquadria', teto: '🛖 Teto', urgencia: '⚡ Urgência', outros: '➕ Outros',
  };

  if (loading) return <div className="p-6 lg:p-8"><div className="h-64 bg-card rounded-xl animate-pulse" /></div>;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Histórico</h1>
      {chamados.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">Nenhum serviço concluído ainda.</div>
      ) : (
        <div className="space-y-3">
          {chamados.map(c => (
            <div key={c.id} className="glass-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">{tipoLabel[c.tipo]?.split(' ')[0]}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{c.condominios?.name} — {c.local}</p>
                  <p className="text-xs text-muted-foreground">{c.concluded_at ? new Date(c.concluded_at).toLocaleDateString('pt-BR') : ''}</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-success/20 text-success">Concluído</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TecnicoHistorico;
