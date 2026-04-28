import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

const TIPO_EMOJI: Record<string, string> = {
  reparo: '🔧', arquitetura: '🏛️', limpeza: '🧹', seguranca: '🔒', outro: '➕',
  pintura_interna: '🖌️', pintura_fachada: '🏗️', esquadria: '🪟', teto: '🛖',
  urgencia: '⚡', outros: '➕',
};

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  aberto:       { label: 'Aberto',       cls: 'bg-warning/20 text-warning' },
  atribuido:    { label: 'Atribuído',    cls: 'bg-blue-500/20 text-blue-400' },
  em_andamento: { label: 'Em Andamento', cls: 'bg-orange-500/20 text-orange-400' },
  concluido:    { label: 'Concluído',    cls: 'bg-success/20 text-success' },
  cancelado:    { label: 'Cancelado',    cls: 'bg-muted text-muted-foreground' },
  aguardando:   { label: 'Aguardando',   cls: 'bg-warning/20 text-warning' },
  aceito:       { label: 'Aceito',       cls: 'bg-blue-500/20 text-blue-400' },
  a_caminho:    { label: 'A Caminho',    cls: 'bg-blue-500/20 text-blue-400' },
};

const PRIO_CONFIG: Record<string, { label: string; cls: string }> = {
  baixa:   { label: 'Baixa',   cls: 'bg-muted text-muted-foreground' },
  media:   { label: 'Média',   cls: 'bg-warning/20 text-warning' },
  alta:    { label: 'Alta',    cls: 'bg-destructive/20 text-destructive' },
  normal:  { label: 'Normal',  cls: 'bg-muted text-muted-foreground' },
  urgente: { label: 'Urgente', cls: 'bg-destructive/20 text-destructive' },
};

const STATUS_TABS = [
  { value: 'todos',        label: 'Todos' },
  { value: 'aberto',       label: 'Abertos' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'concluido',    label: 'Concluídos' },
];

export default function ArquitetoChamados() {
  const { profile } = useAuth();
  const [chamados, setChamados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [busca, setBusca] = useState('');

  const fetchChamados = useCallback(async () => {
    if (!profile?.id) return;

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

    const { data } = await supabase
      .from('chamados')
      .select('*')
      .eq('condominio_id', ref.condominio_id)
      .order('created_at', { ascending: false });

    setChamados(data || []);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { fetchChamados(); }, [fetchChamados]);

  const filtered = chamados.filter(c => {
    if (filtroStatus === 'em_andamento') {
      if (!['em_andamento', 'atribuido', 'aceito', 'a_caminho'].includes(c.status)) return false;
    } else if (filtroStatus !== 'todos') {
      if (c.status !== filtroStatus) return false;
    }
    if (busca) {
      const q = busca.toLowerCase();
      return (c.titulo || c.local || '').toLowerCase().includes(q) ||
             String(c.numero).includes(q);
    }
    return true;
  });

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Chamados</h1>
        <p className="text-muted-foreground">Todos os chamados do condomínio</p>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex rounded-xl bg-muted p-1 gap-1 overflow-x-auto">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setFiltroStatus(tab.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                filtroStatus === tab.value
                  ? 'gradient-primary text-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar..."
            className="pl-10 bg-card"
          />
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-card rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {chamados.length === 0
            ? 'Nenhum chamado encontrado. Você ainda não foi atribuído a um condomínio.'
            : 'Nenhum chamado encontrado para os filtros selecionados.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const st = STATUS_CONFIG[c.status] ?? { label: c.status, cls: 'bg-muted text-muted-foreground' };
            const pr = PRIO_CONFIG[c.prioridade] ?? { label: c.prioridade, cls: 'bg-muted text-muted-foreground' };
            return (
              <div key={c.id} className="glass-card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{TIPO_EMOJI[c.tipo] ?? '📋'}</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      #{String(c.numero).padStart(4, '0')} — {c.titulo || c.local}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.data_abertura || c.created_at).toLocaleDateString('pt-BR')}
                      {c.local ? ` · ${c.local}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${pr.cls}`}>{pr.label}</span>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${st.cls}`}>{st.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
