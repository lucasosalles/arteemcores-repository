import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Search, Loader2, CheckCircle2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

const tipoOptions = [
  { value: 'pintura_interna', label: 'Pintura Interna', icon: '🖌️' },
  { value: 'pintura_fachada', label: 'Pintura Fachada', icon: '🏗️' },
  { value: 'esquadria', label: 'Esquadria', icon: '🪟' },
  { value: 'teto', label: 'Teto', icon: '🛖' },
  { value: 'urgencia', label: 'Urgência', icon: '⚡' },
  { value: 'outros', label: 'Outros', icon: '➕' },
] as const;

const prioridadeOptions = [
  { value: 'normal', label: 'Normal', cls: 'border-muted-foreground text-muted-foreground' },
  { value: 'alta', label: 'Alta', cls: 'border-warning text-warning' },
  { value: 'urgente', label: 'Urgente', cls: 'border-destructive text-destructive' },
] as const;

const statusTabs = [
  { value: 'todos', label: 'Todos' },
  { value: 'aguardando', label: 'Aguardando' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'concluido', label: 'Concluídos' },
];

type ChamadoTipo = typeof tipoOptions[number]['value'];
type Prioridade = typeof prioridadeOptions[number]['value'];

const SindicoChamados: React.FC = () => {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [chamados, setChamados] = useState<any[]>([]);
  const [condo, setCondo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('todos');
  const [search, setSearch] = useState('');
  
  // New chamado modal
  const [showNew, setShowNew] = useState(searchParams.get('novo') === 'true');
  const [step, setStep] = useState(1);
  const [newTipo, setNewTipo] = useState<ChamadoTipo | ''>('');
  const [newLocal, setNewLocal] = useState('');
  const [newDescricao, setNewDescricao] = useState('');
  const [newPrioridade, setNewPrioridade] = useState<Prioridade>('normal');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [newNumero, setNewNumero] = useState(0);

  useEffect(() => {
    fetchData();
  }, [profile?.id]);

  const fetchData = async () => {
    if (!profile?.id) return;
    let { data: condoData } = await supabase
      .from('condominios').select('*').eq('sindico_id', profile.id).maybeSingle();
      
    if (!condoData) {
      // Auto-create on first login
      const { data: newCondo } = await supabase.from('condominios').insert({
        name: 'Meu Condomínio',
        sindico_id: profile.id,
        address: 'Endereço não informado',
        plano: 'essencial',
        limite_atendimentos: 5,
        atendimentos_mes: 0,
        ativo: true
      }).select('*').single();
      condoData = newCondo;
    }

    if (condoData) {
      setCondo(condoData);
      const { data } = await supabase
        .from('chamados').select('*').eq('condominio_id', condoData.id)
        .order('created_at', { ascending: false });
      setChamados(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    let currentCondoId = condo?.id;

    if (!currentCondoId) {
      // Busca o condomínio diretamente do banco
      const { data: condoData, error: condoError } = await supabase
        .from('condominios')
        .select('id')
        .eq('sindico_id', profile!.id)
        .maybeSingle();

      if (condoError || !condoData) {
        toast.error('Condomínio não encontrado. Contate o administrador.');
        return;
      }

      currentCondoId = condoData.id;
      setCondo(condoData);
    }

    if (!newTipo || !newLocal || !newDescricao) {
      toast.error('Preencha todos os campos.');
      return;
    }

    setSubmitting(true);

    const { data, error } = await supabase.from('chamados').insert({
      condominio_id: currentCondoId,
      sindico_id: profile!.id,
      tipo: newTipo as any,
      local: newLocal,
      descricao: newDescricao,
      prioridade: newPrioridade as any,
    }).select().single();

    if (error) {
      toast.error('Erro ao criar chamado', { description: error.message });
    } else {
      setNewNumero(data.numero);
      setSuccess(true);
      fetchData();
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setStep(1);
    setNewTipo('');
    setNewLocal('');
    setNewDescricao('');
    setNewPrioridade('normal');
    setSuccess(false);
    setShowNew(false);
    setSearchParams({});
  };

  const filtered = chamados.filter(c => {
    if (activeFilter === 'em_andamento') return ['aceito', 'a_caminho', 'em_andamento'].includes(c.status);
    if (activeFilter !== 'todos') return c.status === activeFilter;
    return true;
  }).filter(c => {
    if (!search) return true;
    return c.local.toLowerCase().includes(search.toLowerCase()) || 
           String(c.numero).includes(search);
  });

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      aguardando: { label: 'Aguardando', cls: 'bg-warning/20 text-warning' },
      aceito: { label: 'Aceito', cls: 'bg-info/20 text-info' },
      a_caminho: { label: 'A Caminho', cls: 'bg-info/20 text-info' },
      em_andamento: { label: 'Em Andamento', cls: 'bg-accent/20 text-accent' },
      concluido: { label: 'Concluído', cls: 'bg-success/20 text-success' },
      cancelado: { label: 'Cancelado', cls: 'bg-destructive/20 text-destructive' },
    };
    const s = map[status] || { label: status, cls: 'bg-muted text-muted-foreground' };
    return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>;
  };

  const tipoLabel: Record<string, string> = {
    pintura_interna: '🖌️ Pintura Interna', pintura_fachada: '🏗️ Pintura Fachada',
    esquadria: '🪟 Esquadria', teto: '🛖 Teto', urgencia: '⚡ Urgência', outros: '➕ Outros',
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Chamados</h1>
        <Button variant="golden" onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4 mr-2" /> Novo Chamado
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex rounded-xl bg-muted p-1 gap-1 overflow-x-auto">
          {statusTabs.map(tab => (
            <button key={tab.value} onClick={() => setActiveFilter(tab.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                activeFilter === tab.value ? 'gradient-primary text-foreground shadow-md' : 'text-muted-foreground hover:text-foreground'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-10 bg-card" />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-card rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhum chamado encontrado.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <div key={c.id} className="glass-card p-4 flex items-center justify-between hover:bg-muted/30 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <span className="text-xl">{tipoLabel[c.tipo]?.split(' ')[0]}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">#{String(c.numero).padStart(4, '0')} — {c.local}</p>
                  <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {c.prioridade !== 'normal' && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
                    c.prioridade === 'urgente' ? 'border-destructive text-destructive' : 'border-warning text-warning'
                  }`}>{c.prioridade === 'urgente' ? 'Urgente' : 'Alta'}</span>
                )}
                {statusBadge(c.status)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Chamado Modal */}
      <Dialog open={showNew} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {success ? 'Chamado Criado!' : step === 1 ? 'Tipo de Serviço' : step === 2 ? 'Detalhes' : 'Confirmar'}
            </DialogTitle>
          </DialogHeader>

          {success ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-success/20 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <p className="text-lg font-bold text-foreground">Chamado #{String(newNumero).padStart(4, '0')}</p>
              <p className="text-muted-foreground">Aguardando técnico...</p>
              <Button variant="golden" onClick={resetForm}>Fechar</Button>
            </div>
          ) : step === 1 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {tipoOptions.map(t => (
                  <button key={t.value} onClick={() => { setNewTipo(t.value); setStep(2); }}
                    className={`p-4 rounded-xl border text-center transition-all hover:border-secondary ${
                      newTipo === t.value ? 'border-secondary bg-secondary/10' : 'border-border'
                    }`}>
                    <span className="text-2xl block mb-1">{t.icon}</span>
                    <span className="text-sm font-medium text-foreground">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : step === 2 ? (
            <div className="space-y-4">
              <div>
                <Label className="text-foreground/80">Local / Área</Label>
                <Input value={newLocal} onChange={e => setNewLocal(e.target.value)} placeholder="Ex: Bloco A, 3º andar" className="bg-muted" />
              </div>
              <div>
                <Label className="text-foreground/80">Descrição</Label>
                <Textarea value={newDescricao} onChange={e => setNewDescricao(e.target.value)} placeholder="Descreva o serviço necessário..." className="bg-muted min-h-[100px]" />
              </div>
              <div>
                <Label className="text-foreground/80">Prioridade</Label>
                <div className="flex gap-2 mt-1">
                  {prioridadeOptions.map(p => (
                    <button key={p.value} onClick={() => setNewPrioridade(p.value)}
                      className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                        newPrioridade === p.value ? `${p.cls} border-current` : 'border-border text-muted-foreground'
                      }`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
                <Button variant="golden" className="flex-1" onClick={() => setStep(3)} disabled={!newLocal || !newDescricao}>
                  Continuar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="glass-card p-4 space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground text-sm">Tipo</span><span className="text-sm font-medium text-foreground">{tipoOptions.find(t => t.value === newTipo)?.label}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground text-sm">Local</span><span className="text-sm font-medium text-foreground">{newLocal}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground text-sm">Prioridade</span><span className="text-sm font-medium text-foreground capitalize">{newPrioridade}</span></div>
                <div><span className="text-muted-foreground text-sm">Descrição</span><p className="text-sm text-foreground mt-1">{newDescricao}</p></div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
                <Button variant="golden" className="flex-1" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Solicitar Atendimento'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SindicoChamados;
