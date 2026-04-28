import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

const ESPECIALIDADES: { value: string; label: string; icon: string }[] = [
  { value: 'reparo',      label: 'Reparo',      icon: '🔧' },
  { value: 'arquitetura', label: 'Arquitetura', icon: '🏛️' },
  { value: 'limpeza',     label: 'Limpeza',     icon: '🧹' },
  { value: 'seguranca',   label: 'Segurança',   icon: '🔒' },
  { value: 'pintura',     label: 'Pintura',     icon: '🖌️' },
  { value: 'eletrica',    label: 'Elétrica',    icon: '⚡' },
  { value: 'hidraulica',  label: 'Hidráulica',  icon: '🚿' },
  { value: 'jardinagem',  label: 'Jardinagem',  icon: '🌿' },
  { value: 'outro',       label: 'Outro',       icon: '➕' },
];

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const STATUS_LABEL: Record<string, string> = {
  em_andamento: 'Em Andamento', em_execucao: 'Em Execução',
};

export default function PrestadorServicos() {
  const { profile } = useAuth();

  const [recordId, setRecordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [disponivel, setDisponivel] = useState(true);
  const [proximaData, setProximaData] = useState('');
  const [especialidades, setEspecialidades] = useState<string[]>([]);
  const [tempoMedio, setTempoMedio] = useState('');
  const [observacao, setObservacao] = useState('');

  // Agenda
  const [agendaItems, setAgendaItems] = useState<{ day: number; label: string; tipo: string }[]>([]);
  const [agendaMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const fetchAll = useCallback(async () => {
    if (!profile?.id) return;

    const [dispRes, chamRes, orcRes] = await Promise.all([
      supabase.from('disponibilidade_prestador').select('*').eq('prestador_id', profile.id).maybeSingle(),
      supabase.from('chamados').select('data_abertura, created_at, tipo, titulo, local')
        .eq('atribuido_para', profile.id).eq('status', 'em_andamento'),
      supabase.from('orcamentos').select('data_solicitacao, tipo, titulo')
        .eq('prestador_id', profile.id).eq('status', 'em_execucao'),
    ]);

    if (dispRes.data) {
      setRecordId(dispRes.data.id);
      setDisponivel(dispRes.data.disponivel ?? true);
      setProximaData(dispRes.data.proxima_disponibilidade ?? '');
      setEspecialidades(dispRes.data.especialidades ?? []);
      setTempoMedio(dispRes.data.tempo_medio_execucao_dias?.toString() ?? '');
      setObservacao(dispRes.data.observacao ?? '');
    }

    // Build agenda dots
    const items: { day: number; label: string; tipo: string }[] = [];
    const { year, month } = agendaMonth;

    for (const c of chamRes.data || []) {
      const d = new Date(c.data_abertura || c.created_at);
      if (d.getFullYear() === year && d.getMonth() === month) {
        items.push({ day: d.getDate(), label: c.titulo || c.local, tipo: 'chamado' });
      }
    }
    for (const o of orcRes.data || []) {
      if (o.data_solicitacao) {
        const d = new Date(o.data_solicitacao);
        if (d.getFullYear() === year && d.getMonth() === month) {
          items.push({ day: d.getDate(), label: o.titulo, tipo: 'orcamento' });
        }
      }
    }

    setAgendaItems(items);
    setLoading(false);
  }, [profile?.id, agendaMonth]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const toggleEspecialidade = (value: string) => {
    setEspecialidades(prev =>
      prev.includes(value) ? prev.filter(e => e !== value) : [...prev, value]
    );
  };

  const handleSave = async () => {
    if (!profile?.id) return;
    setSaving(true);

    const payload = {
      prestador_id: profile.id,
      disponivel,
      proxima_disponibilidade: proximaData || null,
      especialidades,
      tempo_medio_execucao_dias: tempoMedio ? parseInt(tempoMedio) : null,
      observacao: observacao || null,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (recordId) {
      ({ error } = await supabase.from('disponibilidade_prestador').update(payload).eq('id', recordId));
    } else {
      const { data, error: insertError } = await supabase
        .from('disponibilidade_prestador').insert(payload).select('id').single();
      error = insertError;
      if (data) setRecordId(data.id);
    }

    if (error) {
      toast.error('Erro ao salvar', { description: error.message });
    } else {
      toast.success('Configurações salvas com sucesso');
    }
    setSaving(false);
  };

  // ─── Calendar helpers ─────────────────────────────────────────────────────────
  const { year, month } = agendaMonth;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = new Date(year, month, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const today = new Date().getDate();
  const isCurrentMonth = new Date().getMonth() === month && new Date().getFullYear() === year;

  const agendaByDay = new Map<number, { label: string; tipo: string }[]>();
  for (const item of agendaItems) {
    if (!agendaByDay.has(item.day)) agendaByDay.set(item.day, []);
    agendaByDay.get(item.day)!.push(item);
  }

  const calendarCells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-card rounded-xl animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Serviços</h1>
        <p className="text-muted-foreground">Especialidades, disponibilidade e agenda</p>
      </div>

      {/* ─── Disponibilidade ───────────────────────────────────────────────────── */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Disponibilidade</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setDisponivel(true)}
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl border-2 transition-all ${
              disponivel ? 'border-success bg-success/10 text-success' : 'border-border text-muted-foreground hover:border-success/50'
            }`}
          >
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-semibold">Disponível</span>
          </button>
          <button
            onClick={() => setDisponivel(false)}
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl border-2 transition-all ${
              !disponivel ? 'border-destructive bg-destructive/10 text-destructive' : 'border-border text-muted-foreground hover:border-destructive/50'
            }`}
          >
            <XCircle className="w-5 h-5" />
            <span className="font-semibold">Indisponível</span>
          </button>
        </div>
        {!disponivel && (
          <div>
            <Label className="text-foreground/80">Próxima disponibilidade</Label>
            <Input
              type="date"
              value={proximaData}
              onChange={e => setProximaData(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="bg-muted mt-1"
            />
          </div>
        )}
      </div>

      {/* ─── Especialidades ────────────────────────────────────────────────────── */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Especialidades</h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {ESPECIALIDADES.map(esp => {
            const ativo = especialidades.includes(esp.value);
            return (
              <button
                key={esp.value}
                onClick={() => toggleEspecialidade(esp.value)}
                className={`p-3 rounded-xl border text-center transition-all ${
                  ativo ? 'border-secondary bg-secondary/10 text-foreground' : 'border-border text-muted-foreground hover:border-secondary/50'
                }`}
              >
                <span className="text-xl block mb-1">{esp.icon}</span>
                <span className="text-xs font-medium">{esp.label}</span>
              </button>
            );
          })}
        </div>
        {especialidades.length === 0 && (
          <p className="text-xs text-muted-foreground">Selecione ao menos uma especialidade para aparecer nos resultados.</p>
        )}
      </div>

      {/* ─── Tempo médio + Observação ─────────────────────────────────────────── */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Configurações</h2>
        <div>
          <Label className="text-foreground/80">Tempo médio de execução</Label>
          <div className="flex items-center gap-3 mt-1">
            <Input
              type="number"
              value={tempoMedio}
              onChange={e => setTempoMedio(e.target.value)}
              placeholder="Ex: 3"
              min={1}
              className="bg-muted w-28"
            />
            <span className="text-muted-foreground text-sm">dias úteis por serviço</span>
          </div>
        </div>
        <div>
          <Label className="text-foreground/80">Observação livre</Label>
          <Textarea
            value={observacao}
            onChange={e => setObservacao(e.target.value)}
            placeholder="Ex: Atendo apenas em dias úteis das 8h às 18h. Regiões: Zona Sul e Centro."
            className="bg-muted mt-1 resize-none"
            rows={3}
          />
        </div>
      </div>

      {/* ─── Agenda ───────────────────────────────────────────────────────────── */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">Agenda</h2>
          <span className="text-sm text-muted-foreground capitalize">{monthName}</span>
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map(w => (
            <div key={w} className="text-xs text-muted-foreground font-medium py-1">{w}</div>
          ))}
          {calendarCells.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} />;
            const items = agendaByDay.get(day) ?? [];
            const isToday = isCurrentMonth && day === today;
            return (
              <div
                key={day}
                className={`relative flex flex-col items-center py-1.5 rounded-lg text-xs transition-colors ${
                  isToday ? 'bg-secondary/20 text-secondary font-bold' : items.length > 0 ? 'bg-muted/50' : 'text-muted-foreground'
                }`}
              >
                <span>{day}</span>
                {items.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {items.slice(0, 2).map((item, i) => (
                      <span
                        key={i}
                        title={item.label}
                        className={`w-1.5 h-1.5 rounded-full ${item.tipo === 'chamado' ? 'bg-orange-400' : 'bg-purple-400'}`}
                      />
                    ))}
                    {items.length > 2 && <span className="text-muted-foreground" style={{ fontSize: 8 }}>+</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-400" />Chamados ativos</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-400" />Orçamentos em execução</span>
        </div>

        {agendaItems.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-2">Nenhum serviço agendado este mês.</p>
        )}
      </div>

      {/* ─── Salvar ────────────────────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <Button variant="golden" onClick={handleSave} disabled={saving} className="min-w-32">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
        </Button>
      </div>
    </div>
  );
}
