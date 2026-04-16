import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { atribuirChamado as executarAtribuicao } from '@/lib/chamadoFlow';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ClipboardList, Clock, CheckCircle2, TrendingUp, Loader2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
    baixa:   { label: 'Baixa',   cls: 'bg-muted text-muted-foreground' },
    media:   { label: 'Média',   cls: 'bg-warning/20 text-warning' },
    alta:    { label: 'Alta',    cls: 'bg-destructive/20 text-destructive' },
    normal:  { label: 'Normal',  cls: 'bg-muted text-muted-foreground' },
    urgente: { label: 'Urgente', cls: 'bg-destructive/20 text-destructive' },
  };
  const p = map[prioridade] || { label: prioridade, cls: 'bg-muted text-muted-foreground' };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${p.cls}`}>{p.label}</span>;
};

const SindicoDashboard: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [condo, setCondo] = useState<any>(null);
  const [chamados, setChamados] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('todos');
  const [filterTipo, setFilterTipo] = useState('todos');
  const [filterPrioridade, setFilterPrioridade] = useState('todos');
  const [atribuirChamado, setAtribuirChamado] = useState<any>(null);
  const [executores, setExecutores] = useState<any[]>([]);
  const [executorSelecionado, setExecutorSelecionado] = useState('');
  const [atribuindo, setAtribuindo] = useState(false);

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
      const { data } = await supabase
        .from('chamados')
        .select('*')
        .eq('condominio_id', condoData.id)
        .order('created_at', { ascending: false });
      setChamados(data || []);
    }
    setLoading(false);
  };

  const fetchExecutores = async () => {
    const { data: roles } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .in('role', ['arquiteto', 'prestador'] as any);

    if (roles && roles.length > 0) {
      const ids = roles.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles').select('id, full_name').in('id', ids);
      setExecutores(
        (profiles || []).map(p => ({
          ...p,
          perfil: roles.find(r => r.user_id === p.id)?.role,
        }))
      );
    } else {
      setExecutores([]);
    }
  };

  const openAtribuir = async (chamado: any) => {
    setAtribuirChamado(chamado);
    setExecutorSelecionado('');
    await fetchExecutores();
  };

  const handleAtribuir = async () => {
    if (!executorSelecionado || !atribuirChamado) return;
    setAtribuindo(true);

    const result = await executarAtribuicao({
      chamadoId: atribuirChamado.id,
      statusAtual: atribuirChamado.status,
      atribuidoPara: executorSelecionado,
      sindicoId: profile!.id,
    });

    if (!result.ok) {
      toast.error('Erro ao atribuir chamado', { description: result.erro });
      setAtribuindo(false);
      return;
    }

    toast.success('Chamado atribuído com sucesso!');
    setAtribuirChamado(null);
    setExecutorSelecionado('');
    fetchData();
    setAtribuindo(false);
  };

  const stats = {
    total:        chamados.length,
    abertos:      chamados.filter(c => ['aberto', 'aguardando'].includes(c.status)).length,
    em_andamento: chamados.filter(c => ['atribuido', 'aceito', 'a_caminho', 'em_andamento'].includes(c.status)).length,
    concluidos:   chamados.filter(c => c.status === 'concluido').length,
  };

  const filtered = chamados.filter(c => {
    if (filterStatus !== 'todos' && c.status !== filterStatus) return false;
    if (filterTipo !== 'todos' && c.tipo !== filterTipo) return false;
    if (filterPrioridade !== 'todos' && c.prioridade !== filterPrioridade) return false;
    return true;
  });

  if (loading) return (
    <div className="p-6 lg:p-8 space-y-6">
      {[1, 2, 3].map(i => <div key={i} className="h-24 bg-card rounded-xl animate-pulse" />)}
    </div>
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Olá, {profile?.full_name?.split(' ')[0]} 👋
          </h1>
          <p className="text-muted-foreground">{condo?.name || 'Seu condomínio'}</p>
        </div>
        <Button variant="golden" onClick={() => navigate('/sindico/chamados?novo=true')}>
          <Plus className="w-4 h-4 mr-2" /> Novo Chamado
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total',        value: stats.total,        icon: <ClipboardList className="w-5 h-5" />, color: 'text-secondary' },
          { label: 'Abertos',      value: stats.abertos,      icon: <Clock className="w-5 h-5" />,         color: 'text-warning' },
          { label: 'Em Andamento', value: stats.em_andamento, icon: <TrendingUp className="w-5 h-5" />,    color: 'text-orange-400' },
          { label: 'Concluídos',   value: stats.concluidos,   icon: <CheckCircle2 className="w-5 h-5" />,  color: 'text-success' },
        ].map(stat => (
          <div key={stat.label} className="glass-card p-5">
            <div className={`${stat.color} mb-2`}>{stat.icon}</div>
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44 bg-card">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="aberto">Aberto</SelectItem>
            <SelectItem value="atribuido">Atribuído</SelectItem>
            <SelectItem value="em_andamento">Em Andamento</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-44 bg-card">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="reparo">Reparo</SelectItem>
            <SelectItem value="arquitetura">Arquitetura</SelectItem>
            <SelectItem value="limpeza">Limpeza</SelectItem>
            <SelectItem value="seguranca">Segurança</SelectItem>
            <SelectItem value="outro">Outro</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterPrioridade} onValueChange={setFilterPrioridade}>
          <SelectTrigger className="w-44 bg-card">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas as prioridades</SelectItem>
            <SelectItem value="baixa">Baixa</SelectItem>
            <SelectItem value="media">Média</SelectItem>
            <SelectItem value="alta">Alta</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {filtered.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">
          Nenhum chamado encontrado.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <div key={c.id} className="glass-card p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-lg shrink-0">{tipoLabel[c.tipo]?.split(' ')[0] || '📋'}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {c.titulo || c.local}{' '}
                      <span className="text-muted-foreground font-normal">
                        #{String(c.numero).padStart(4, '0')}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tipoLabel[c.tipo]?.split(' ').slice(1).join(' ')}
                      {' · '}{new Date(c.data_abertura || c.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {prioridadeBadge(c.prioridade)}
                  {statusBadge(c.status)}
                </div>
              </div>
              {['aberto', 'aguardando'].includes(c.status) && (
                <Button variant="outline" size="sm" className="w-full text-secondary border-secondary/30"
                  onClick={() => openAtribuir(c)}>
                  Atribuir
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal de atribuição */}
      <Dialog open={!!atribuirChamado} onOpenChange={(open) => { if (!open) setAtribuirChamado(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Atribuir Chamado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Chamado:{' '}
              <span className="text-foreground font-medium">
                {atribuirChamado?.titulo || atribuirChamado?.local}
              </span>
            </p>
            {executores.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum arquiteto ou prestador cadastrado no sistema.
              </p>
            ) : (
              <Select value={executorSelecionado} onValueChange={setExecutorSelecionado}>
                <SelectTrigger className="bg-muted">
                  <SelectValue placeholder="Selecione o executor..." />
                </SelectTrigger>
                <SelectContent>
                  {executores.map(e => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name}{' '}
                      <span className="text-muted-foreground capitalize">({e.perfil})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="golden" className="w-full" onClick={handleAtribuir}
              disabled={atribuindo || !executorSelecionado}>
              {atribuindo ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Atribuição'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SindicoDashboard;
