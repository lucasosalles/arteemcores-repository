import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

// ─── Especialidades disponíveis ───────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function PrestadorDisponibilidade() {
  const { profile } = useAuth();

  const [recordId, setRecordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [disponivel, setDisponivel] = useState(true);
  const [proximaData, setProximaData] = useState('');
  const [especialidades, setEspecialidades] = useState<string[]>([]);
  const [tempoMedio, setTempoMedio] = useState('');
  const [observacao, setObservacao] = useState('');

  // ─── Fetch ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!profile?.id) return;

    const fetchDisponibilidade = async () => {
      const { data } = await supabase
        .from('disponibilidade_prestador')
        .select('*')
        .eq('prestador_id', profile.id)
        .maybeSingle();

      if (data) {
        setRecordId(data.id);
        setDisponivel(data.disponivel ?? true);
        setProximaData(data.proxima_disponibilidade ?? '');
        setEspecialidades(data.especialidades ?? []);
        setTempoMedio(data.tempo_medio_execucao_dias?.toString() ?? '');
        setObservacao(data.observacao ?? '');
      }
      setLoading(false);
    };

    fetchDisponibilidade();
  }, [profile?.id]);

  // ─── Toggle especialidade ─────────────────────────────────────────────────

  const toggleEspecialidade = (value: string) => {
    setEspecialidades(prev =>
      prev.includes(value) ? prev.filter(e => e !== value) : [...prev, value],
    );
  };

  // ─── Save ─────────────────────────────────────────────────────────────────

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
      ({ error } = await supabase
        .from('disponibilidade_prestador')
        .update(payload)
        .eq('id', recordId));
    } else {
      const { data, error: insertError } = await supabase
        .from('disponibilidade_prestador')
        .insert(payload)
        .select('id')
        .single();
      error = insertError;
      if (data) setRecordId(data.id);
    }

    if (error) {
      toast.error('Erro ao salvar disponibilidade', { description: error.message });
    } else {
      toast.success('Disponibilidade atualizada com sucesso');
    }
    setSaving(false);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 lg:p-8 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-card rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Disponibilidade</h1>
        <p className="text-muted-foreground">
          Gerencie sua disponibilidade para novos serviços.
        </p>
      </div>

      {/* ─── Toggle disponível ─────────────────────────────────────────────── */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          Status atual
        </h2>
        <div className="flex gap-3">
          <button
            onClick={() => setDisponivel(true)}
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl border-2 transition-all ${
              disponivel
                ? 'border-success bg-success/10 text-success'
                : 'border-border text-muted-foreground hover:border-success/50'
            }`}
          >
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-semibold">Disponível</span>
          </button>
          <button
            onClick={() => setDisponivel(false)}
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl border-2 transition-all ${
              !disponivel
                ? 'border-destructive bg-destructive/10 text-destructive'
                : 'border-border text-muted-foreground hover:border-destructive/50'
            }`}
          >
            <XCircle className="w-5 h-5" />
            <span className="font-semibold">Indisponível</span>
          </button>
        </div>

        {/* Próxima disponibilidade (só quando indisponível) */}
        {!disponivel && (
          <div>
            <Label className="text-foreground/80">
              Próxima disponibilidade
            </Label>
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

      {/* ─── Especialidades ────────────────────────────────────────────────── */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          Especialidades
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {ESPECIALIDADES.map(esp => {
            const ativo = especialidades.includes(esp.value);
            return (
              <button
                key={esp.value}
                onClick={() => toggleEspecialidade(esp.value)}
                className={`p-3 rounded-xl border text-center transition-all ${
                  ativo
                    ? 'border-secondary bg-secondary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:border-secondary/50'
                }`}
              >
                <span className="text-xl block mb-1">{esp.icon}</span>
                <span className="text-xs font-medium">{esp.label}</span>
              </button>
            );
          })}
        </div>
        {especialidades.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Selecione ao menos uma especialidade para aparecer nos resultados.
          </p>
        )}
      </div>

      {/* ─── Tempo médio ───────────────────────────────────────────────────── */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          Tempo médio de execução
        </h2>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            value={tempoMedio}
            onChange={e => setTempoMedio(e.target.value)}
            placeholder="Ex: 3"
            min={1}
            className="bg-muted w-32"
          />
          <span className="text-muted-foreground text-sm">dias úteis por serviço</span>
        </div>
      </div>

      {/* ─── Observação ────────────────────────────────────────────────────── */}
      <div className="glass-card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          Observação livre
        </h2>
        <Textarea
          value={observacao}
          onChange={e => setObservacao(e.target.value)}
          placeholder="Ex: Atendo apenas em dias úteis das 8h às 18h. Regiões: Zona Sul e Centro."
          className="bg-muted resize-none"
          rows={4}
        />
      </div>

      {/* ─── Salvar ────────────────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <Button variant="golden" onClick={handleSave} disabled={saving} className="min-w-32">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
        </Button>
      </div>
    </div>
  );
}
