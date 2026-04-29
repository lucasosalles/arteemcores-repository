import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { abrirChamado } from '@/lib/chamadoFlow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Loader2, CheckCircle2 } from 'lucide-react';

const tipoOptions = [
  { value: 'reparo', label: 'Reparo', icon: '🔧' },
  { value: 'arquitetura', label: 'Arquitetura', icon: '🏛️' },
  { value: 'limpeza', label: 'Limpeza', icon: '🧹' },
  { value: 'seguranca', label: 'Segurança', icon: '🔒' },
  { value: 'outro', label: 'Outro', icon: '➕' },
] as const;

const prioridadeOptions = [
  { value: 'baixa', label: 'Baixa', cls: 'border-muted-foreground text-muted-foreground' },
  { value: 'media', label: 'Média', cls: 'border-warning text-warning' },
  { value: 'alta', label: 'Alta', cls: 'border-destructive text-destructive' },
] as const;

type ChamadoTipo = typeof tipoOptions[number]['value'];
type Prioridade = typeof prioridadeOptions[number]['value'];

const tipoLabel: Record<string, string> = {
  reparo: '🔧 Reparo', arquitetura: '🏛️ Arquitetura', limpeza: '🧹 Limpeza',
  seguranca: '🔒 Segurança', outro: '➕ Outro',
};

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; cls: string }> = {
    aberto:       { label: 'Aberto',       cls: 'bg-warning/20 text-warning' },
    atribuido:    { label: 'Atribuído',    cls: 'bg-blue-500/20 text-blue-400' },
    em_andamento: { label: 'Em Andamento', cls: 'bg-orange-500/20 text-orange-400' },
    concluido:    { label: 'Concluído',    cls: 'bg-success/20 text-success' },
    cancelado:    { label: 'Cancelado',    cls: 'bg-muted text-muted-foreground' },
  };
  const s = map[status] || { label: status, cls: 'bg-muted text-muted-foreground' };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>;
};

const MoradorChamados: React.FC = () => {
  const { profile } = useAuth();
  const [chamados, setChamados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [step, setStep] = useState(1);
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<ChamadoTipo | ''>('');
  const [local, setLocal] = useState('');
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState<Prioridade>('media');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [novoNumero, setNovoNumero] = useState(0);

  const fetchChamados = async () => {
    if (!profile?.id) return;
    const { data, error } = await supabase
      .from('chamados')
      .select('*')
      .eq('criado_por', profile.id)
      .order('data_abertura', { ascending: false });
    if (error) toast.error('Erro ao carregar chamados: ' + error.message);
    setChamados(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchChamados(); }, [profile?.id]);

  const handleSubmit = async () => {
    if (!titulo || !tipo || !local || descricao.length < 10) {
      toast.error('Preencha todos os campos. Descrição mínima de 10 caracteres.');
      return;
    }
    setSubmitting(true);

    const { data: condoData } = await supabase
      .from('condominios').select('id').eq('ativo', true).limit(1).maybeSingle();

    if (!condoData) {
      toast.error('Nenhum condomínio ativo encontrado. Contate o administrador.');
      setSubmitting(false);
      return;
    }

    const result = await abrirChamado(
      {
        titulo,
        tipo,
        local,
        descricao: `${local} — ${descricao}`,
        prioridade,
        condominioId: condoData.id,
        criadoPor: profile!.id,
        sindicoId: profile!.id,
      },
      'morador',
    );

    if (!result.ok) {
      toast.error('Erro ao criar chamado', { description: result.erro });
    } else {
      setNovoNumero(result.data.numero);
      setSuccess(true);
      fetchChamados();
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setStep(1); setTitulo(''); setTipo(''); setLocal('');
    setDescricao(''); setPrioridade('media');
    setSuccess(false); setShowNew(false);
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meus Chamados</h1>
          <p className="text-muted-foreground">Olá, {profile?.full_name?.split(' ')[0]}</p>
        </div>
        <Button variant="golden" onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4 mr-2" /> Novo Chamado
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-card rounded-xl animate-pulse" />)}</div>
      ) : chamados.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">
          Nenhum chamado ainda. Abra o primeiro!
        </div>
      ) : (
        <div className="space-y-3">
          {chamados.map(c => (
            <div key={c.id} className="glass-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">{tipoLabel[c.tipo]?.split(' ')[0] || '📋'}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{c.titulo || c.local}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(c.data_abertura || c.created_at).toLocaleDateString('pt-BR')}
                    {' · '}{tipoLabel[c.tipo]?.split(' ').slice(1).join(' ')}
                  </p>
                </div>
              </div>
              {statusBadge(c.status)}
            </div>
          ))}
        </div>
      )}

      <Dialog open={showNew} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {success ? 'Chamado Aberto!' : step === 1 ? 'Tipo de Chamado' : 'Detalhes'}
            </DialogTitle>
          </DialogHeader>

          {success ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-success/20 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <p className="text-lg font-bold text-foreground">Chamado #{String(novoNumero).padStart(4, '0')}</p>
              <p className="text-muted-foreground">Seu chamado foi registrado com sucesso.</p>
              <Button variant="golden" onClick={resetForm}>Fechar</Button>
            </div>
          ) : step === 1 ? (
            <div className="grid grid-cols-2 gap-3">
              {tipoOptions.map(t => (
                <button key={t.value} onClick={() => { setTipo(t.value); setStep(2); }}
                  className={`p-4 rounded-xl border text-center transition-all hover:border-secondary ${
                    tipo === t.value ? 'border-secondary bg-secondary/10' : 'border-border'
                  }`}>
                  <span className="text-2xl block mb-1">{t.icon}</span>
                  <span className="text-sm font-medium text-foreground">{t.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label className="text-foreground/80">Título</Label>
                <Input value={titulo} onChange={e => setTitulo(e.target.value)}
                  placeholder="Ex: Vazamento no banheiro" className="bg-muted mt-1" />
              </div>
              <div>
                <Label className="text-foreground/80">Local</Label>
                <Input value={local} onChange={e => setLocal(e.target.value)}
                  placeholder="Ex: Apto 201, Bloco A" className="bg-muted mt-1" />
              </div>
              <div>
                <Label className="text-foreground/80">
                  Descrição <span className="text-muted-foreground text-xs">(mín. 10 caracteres)</span>
                </Label>
                <Textarea value={descricao} onChange={e => setDescricao(e.target.value)}
                  placeholder="Descreva o problema com detalhes..."
                  className="bg-muted min-h-[100px] mt-1" />
              </div>
              <div>
                <Label className="text-foreground/80">Prioridade</Label>
                <div className="flex gap-2 mt-1">
                  {prioridadeOptions.map(p => (
                    <button key={p.value} onClick={() => setPrioridade(p.value)}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                        prioridade === p.value ? `${p.cls} border-current` : 'border-border text-muted-foreground'
                      }`}>{p.label}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
                <Button variant="golden" className="flex-1" onClick={handleSubmit}
                  disabled={submitting || !titulo || !local || descricao.length < 10}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Abrir Chamado'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MoradorChamados;
