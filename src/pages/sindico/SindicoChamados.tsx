import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { abrirChamado, criarOrcamentoParaChamado } from '@/lib/chamadoFlow';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Search, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

const tipoOptions = [
  { value: 'reparo',      label: 'Reparo',      icon: '🔧' },
  { value: 'arquitetura', label: 'Arquitetura', icon: '🏛️' },
  { value: 'limpeza',     label: 'Limpeza',     icon: '🧹' },
  { value: 'seguranca',   label: 'Segurança',   icon: '🔒' },
  { value: 'outro',       label: 'Outro',       icon: '➕' },
] as const;

const prioridadeOptions = [
  { value: 'baixa', label: 'Baixa', cls: 'border-muted-foreground text-muted-foreground' },
  { value: 'media', label: 'Média', cls: 'border-warning text-warning' },
  { value: 'alta',  label: 'Alta',  cls: 'border-destructive text-destructive' },
] as const;

const statusTabs = [
  { value: 'todos',        label: 'Todos' },
  { value: 'aberto',       label: 'Abertos' },
  { value: 'atribuido',    label: 'Atribuídos' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'concluido',    label: 'Concluídos' },
];

type ChamadoTipo = typeof tipoOptions[number]['value'];
type Prioridade = typeof prioridadeOptions[number]['value'];

const tipoLabel: Record<string, string> = {
  reparo: '🔧 Reparo', arquitetura: '🏛️ Arquitetura', limpeza: '🧹 Limpeza',
  seguranca: '🔒 Segurança', outro: '➕ Outro',
  pintura_interna: '🖌️ Pintura Interna', pintura_fachada: '🏗️ Pintura Fachada',
  esquadria: '🪟 Esquadria', teto: '🛖 Teto', urgencia: '⚡ Urgência', outros: '➕ Outros',
};

const statusBadge = (status: string) => {
  const map: Record<string, { label: string; cls: string }> = {
    aberto:       { label: 'Aberto',       cls: 'bg-warning/20 text-warning' },
    atribuido:    { label: 'Atribuído',    cls: 'bg-blue-500/20 text-blue-400' },
    em_andamento: { label: 'Em Andamento', cls: 'bg-orange-500/20 text-orange-400' },
    concluido:    { label: 'Concluído',    cls: 'bg-success/20 text-success' },
    cancelado:    { label: 'Cancelado',    cls: 'bg-muted text-muted-foreground' },
    aguardando:   { label: 'Aguardando',   cls: 'bg-warning/20 text-warning' },
    aceito:       { label: 'Aceito',       cls: 'bg-blue-500/20 text-blue-400' },
    a_caminho:    { label: 'A Caminho',    cls: 'bg-blue-500/20 text-blue-400' },
  };
  const s = map[status] || { label: status, cls: 'bg-muted text-muted-foreground' };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>;
};

const prioridadeBadge = (prioridade: string) => {
  const map: Record<string, { label: string; cls: string }> = {
    baixa:   { label: 'Baixa',   cls: 'border-muted-foreground text-muted-foreground' },
    media:   { label: 'Média',   cls: 'border-warning text-warning' },
    alta:    { label: 'Alta',    cls: 'border-destructive text-destructive' },
    normal:  { label: 'Normal',  cls: 'border-muted-foreground text-muted-foreground' },
    urgente: { label: 'Urgente', cls: 'border-destructive text-destructive' },
  };
  const p = map[prioridade] || { label: prioridade, cls: 'border-muted-foreground text-muted-foreground' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${p.cls}`}>{p.label}</span>;
};

const SindicoChamados: React.FC = () => {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [chamados, setChamados] = useState<any[]>([]);
  const [condo, setCondo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('todos');
  const [search, setSearch] = useState('');

  const [chamadosComOrcamento, setChamadosComOrcamento] = useState<Set<string>>(new Set());
  const [addingExtra, setAddingExtra] = useState<string | null>(null);

  const [showNew, setShowNew] = useState(searchParams.get('novo') === 'true');
  const [step, setStep] = useState(1);
  const [newTitulo, setNewTitulo] = useState('');
  const [newTipo, setNewTipo] = useState<ChamadoTipo | ''>('');
  const [newLocal, setNewLocal] = useState('');
  const [newDescricao, setNewDescricao] = useState('');
  const [newPrioridade, setNewPrioridade] = useState<Prioridade>('media');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [newNumero, setNewNumero] = useState(0);

  useEffect(() => { fetchData(); }, [profile?.id]);

  const fetchData = async () => {
    if (!profile?.id) return;
    let { data: condoData } = await supabase
      .from('condominios').select('*').eq('sindico_id', profile.id).maybeSingle();

    if (!condoData) {
      const { data: newCondo } = await supabase.from('condominios').insert({
        name: 'Meu Condomínio', sindico_id: profile.id,
        address: 'Endereço não informado', plano: 'essencial',
        limite_atendimentos: 5, atendimentos_mes: 0, ativo: true,
      }).select('*').single();
      condoData = newCondo;
    }

    if (condoData) {
      setCondo(condoData);
      const { data: chamadosData } = await supabase
        .from('chamados').select('*').eq('condominio_id', condoData.id)
        .order('created_at', { ascending: false });
      setChamados(chamadosData || []);

      // Quais chamados já têm orçamento vinculado (fora do plano)
      if (chamadosData && chamadosData.length > 0) {
        const ids = chamadosData.map((c: any) => c.id);
        const { data: orcData } = await supabase
          .from('orcamentos')
          .select('chamado_id')
          .in('chamado_id', ids);
        const set = new Set<string>((orcData || []).map((o: any) => o.chamado_id));
        setChamadosComOrcamento(set);
      }
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    let currentCondoId = condo?.id;
    if (!currentCondoId) {
      const { data: condoData } = await supabase
        .from('condominios').select('id').eq('sindico_id', profile!.id).maybeSingle();
      if (!condoData) { toast.error('Condomínio não encontrado.'); return; }
      currentCondoId = condoData.id;
    }

    if (!newTitulo || !newTipo || !newLocal || !newDescricao) {
      toast.error('Preencha todos os campos.');
      return;
    }

    setSubmitting(true);
    const result = await abrirChamado(
      {
        titulo: newTitulo,
        tipo: newTipo,
        local: newLocal,
        descricao: newDescricao,
        prioridade: newPrioridade,
        condominioId: currentCondoId,
        criadoPor: profile!.id,
        sindicoId: profile!.id,
      },
      'sindico',
    );

    if (!result.ok) {
      toast.error('Erro ao criar chamado', { description: result.erro });
    } else {
      setNewNumero(result.data.numero);
      setSuccess(true);
      fetchData();
    }
    setSubmitting(false);
  };

  const handleAddServico = async (c: any) => {
    setAddingExtra(c.id);
    const result = await criarOrcamentoParaChamado({
      chamadoId: c.id,
      condominioId: condo?.id ?? c.condominio_id,
      titulo: c.titulo || c.local,
      tipo: c.tipo,
      descricao: c.descricao ?? '',
      solicitanteId: profile!.id,
      numeroChamado: c.numero,
    });
    if (!result.ok) {
      toast.error('Erro ao criar serviço extra', { description: result.erro });
    } else {
      toast.success('Orçamento de serviço extra criado e enviado para prestadores');
      fetchData();
    }
    setAddingExtra(null);
  };

  const resetForm = () => {
    setStep(1); setNewTitulo(''); setNewTipo(''); setNewLocal('');
    setNewDescricao(''); setNewPrioridade('media');
    setSuccess(false); setShowNew(false); setSearchParams({});
  };

  const filtered = chamados.filter(c => {
    if (activeFilter === 'em_andamento') return ['aceito', 'a_caminho', 'em_andamento', 'atribuido'].includes(c.status);
    if (activeFilter !== 'todos') return c.status === activeFilter;
    return true;
  }).filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (c.titulo || c.local || '').toLowerCase().includes(q) || String(c.numero).includes(q);
  });

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Chamados</h1>
        <Button variant="golden" onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4 mr-2" /> Novo Chamado
        </Button>
      </div>

      {/* Barra de uso do plano */}
      {condo && (
        <div className="glass-card p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Uso do plano <span className="capitalize font-medium text-foreground">{condo.plano}</span>
            </span>
            <span className={`font-semibold ${
              (condo.atendimentos_mes ?? 0) >= (condo.limite_atendimentos ?? 0)
                ? 'text-destructive' : 'text-foreground'
            }`}>
              {condo.atendimentos_mes ?? 0} / {condo.limite_atendimentos ?? 0} atendimentos
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                (condo.atendimentos_mes ?? 0) >= (condo.limite_atendimentos ?? 1)
                  ? 'bg-destructive' : 'bg-secondary'
              }`}
              style={{
                width: `${Math.min(100, ((condo.atendimentos_mes ?? 0) / (condo.limite_atendimentos ?? 1)) * 100)}%`,
              }}
            />
          </div>
          {(condo.atendimentos_mes ?? 0) >= (condo.limite_atendimentos ?? 0) && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Limite atingido — novos chamados gerarão orçamento de serviço extra automaticamente.
            </p>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex rounded-xl bg-muted p-1 gap-1 overflow-x-auto">
          {statusTabs.map(tab => (
            <button key={tab.value} onClick={() => setActiveFilter(tab.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                activeFilter === tab.value
                  ? 'gradient-primary text-foreground shadow-md'
                  : 'text-muted-foreground hover:text-foreground'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar..." className="pl-10 bg-card" />
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-card rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">Nenhum chamado encontrado.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const temOrcamento = chamadosComOrcamento.has(c.id);
            return (
              <div key={c.id} className="glass-card p-4 space-y-2 hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{tipoLabel[c.tipo]?.split(' ')[0] || '📋'}</span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        #{String(c.numero).padStart(4, '0')} — {c.titulo || c.local}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(c.data_abertura || c.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {temOrcamento && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-destructive/20 text-destructive flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Fora do Plano
                      </span>
                    )}
                    {prioridadeBadge(c.prioridade)}
                    {statusBadge(c.status)}
                  </div>
                </div>
                {!temOrcamento && c.status !== 'cancelado' && c.status !== 'concluido' && (
                  <div className="pl-9">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      disabled={addingExtra === c.id}
                      onClick={() => handleAddServico(c)}
                    >
                      {addingExtra === c.id
                        ? <Loader2 className="w-3 h-3 animate-spin mr-1" />
                        : <AlertTriangle className="w-3 h-3 mr-1" />}
                      Adicionar Serviço Extra
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal novo chamado */}
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
              <p className="text-muted-foreground">Chamado aberto com sucesso.</p>
              <Button variant="golden" onClick={resetForm}>Fechar</Button>
            </div>
          ) : step === 1 ? (
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
          ) : step === 2 ? (
            <div className="space-y-4">
              <div>
                <Label className="text-foreground/80">Título</Label>
                <Input value={newTitulo} onChange={e => setNewTitulo(e.target.value)}
                  placeholder="Ex: Vazamento no corredor" className="bg-muted mt-1" />
              </div>
              <div>
                <Label className="text-foreground/80">Local / Área</Label>
                <Input value={newLocal} onChange={e => setNewLocal(e.target.value)}
                  placeholder="Ex: Bloco A, 3º andar" className="bg-muted mt-1" />
              </div>
              <div>
                <Label className="text-foreground/80">Descrição</Label>
                <Textarea value={newDescricao} onChange={e => setNewDescricao(e.target.value)}
                  placeholder="Descreva o serviço necessário..." className="bg-muted min-h-[100px] mt-1" />
              </div>
              <div>
                <Label className="text-foreground/80">Prioridade</Label>
                <div className="flex gap-2 mt-1">
                  {prioridadeOptions.map(p => (
                    <button key={p.value} onClick={() => setNewPrioridade(p.value)}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                        newPrioridade === p.value ? `${p.cls} border-current` : 'border-border text-muted-foreground'
                      }`}>{p.label}</button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>Voltar</Button>
                <Button variant="golden" className="flex-1" onClick={() => setStep(3)}
                  disabled={!newTitulo || !newLocal || !newDescricao}>
                  Continuar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="glass-card p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Tipo</span>
                  <span className="text-sm font-medium text-foreground">{tipoOptions.find(t => t.value === newTipo)?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Título</span>
                  <span className="text-sm font-medium text-foreground">{newTitulo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Local</span>
                  <span className="text-sm font-medium text-foreground">{newLocal}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground text-sm">Prioridade</span>
                  <span className="text-sm font-medium text-foreground capitalize">{newPrioridade}</span>
                </div>
                <div>
                  <span className="text-muted-foreground text-sm">Descrição</span>
                  <p className="text-sm text-foreground mt-1">{newDescricao}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>Voltar</Button>
                <Button variant="golden" className="flex-1" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Criar Chamado'}
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
