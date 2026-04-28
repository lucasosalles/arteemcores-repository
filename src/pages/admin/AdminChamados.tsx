import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search } from 'lucide-react';
import { toast } from 'sonner';

const AdminChamados: React.FC = () => {
  const [chamados, setChamados] = useState<any[]>([]);
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [selectedChamado, setSelectedChamado] = useState<any>(null);

  const fetchData = async () => {
    const [chamRes, tecRes] = await Promise.all([
      supabase.from('chamados').select('*, condominios(name), profiles!chamados_tecnico_id_fkey(full_name)').order('created_at', { ascending: false }),
      supabase.from('user_roles').select('user_id, profiles(id, full_name)').in('role', ['prestador', 'tecnico']),
    ]);
    setChamados(chamRes.data || []);
    setTecnicos(tecRes.data?.map((t: any) => t.profiles) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const assignTecnico = async (chamadoId: string, tecnicoId: string) => {
    const { error } = await supabase.from('chamados').update({ tecnico_id: tecnicoId, status: 'aceito' as any }).eq('id', chamadoId);
    if (error) toast.error(error.message);
    else { toast.success('Técnico designado!'); fetchData(); setSelectedChamado(null); }
  };

  const updateStatus = async (chamadoId: string, status: string) => {
    const updates: any = { status: status as any };
    if (status === 'concluido') updates.concluded_at = new Date().toISOString();
    const { error } = await supabase.from('chamados').update(updates).eq('id', chamadoId);
    if (error) toast.error(error.message);
    else { toast.success('Status atualizado!'); fetchData(); setSelectedChamado(null); }
  };

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

  const filtered = chamados.filter(c => {
    if (filterStatus !== 'todos' && c.status !== filterStatus) return false;
    if (search && !c.local.toLowerCase().includes(search.toLowerCase()) && !String(c.numero).includes(search)) return false;
    return true;
  });

  if (loading) return <div className="p-6 lg:p-8"><div className="h-64 bg-card rounded-xl animate-pulse" /></div>;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Gestão de Chamados</h1>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-10 bg-card" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48 bg-card"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="aguardando">Aguardando</SelectItem>
            <SelectItem value="aceito">Aceito</SelectItem>
            <SelectItem value="em_andamento">Em Andamento</SelectItem>
            <SelectItem value="concluido">Concluído</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 text-muted-foreground font-medium">#</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Condomínio</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Tipo</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Local</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Técnico</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Data</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 cursor-pointer" onClick={() => setSelectedChamado(c)}>
                  <td className="p-3 text-foreground font-mono">#{String(c.numero).padStart(4, '0')}</td>
                  <td className="p-3 text-foreground">{c.condominios?.name || '—'}</td>
                  <td className="p-3 text-muted-foreground capitalize">{c.tipo?.replace('_', ' ')}</td>
                  <td className="p-3 text-muted-foreground">{c.local}</td>
                  <td className="p-3">{statusBadge(c.status)}</td>
                  <td className="p-3 text-muted-foreground">{c.profiles?.full_name || '—'}</td>
                  <td className="p-3 text-muted-foreground">{new Date(c.created_at).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail modal */}
      <Dialog open={!!selectedChamado} onOpenChange={() => setSelectedChamado(null)}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader><DialogTitle className="text-foreground">Chamado #{selectedChamado && String(selectedChamado.numero).padStart(4, '0')}</DialogTitle></DialogHeader>
          {selectedChamado && (
            <div className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Condomínio</span><span className="text-foreground">{selectedChamado.condominios?.name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Local</span><span className="text-foreground">{selectedChamado.local}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tipo</span><span className="text-foreground capitalize">{selectedChamado.tipo?.replace('_', ' ')}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Prioridade</span><span className="text-foreground capitalize">{selectedChamado.prioridade}</span></div>
                <div className="flex justify-between items-center"><span className="text-muted-foreground">Status</span>{statusBadge(selectedChamado.status)}</div>
              </div>
              <p className="text-sm text-muted-foreground">{selectedChamado.descricao}</p>

              {/* Assign tecnico */}
              <div>
                <label className="text-sm text-foreground/80 mb-1 block">Designar Técnico</label>
                <Select onValueChange={v => assignTecnico(selectedChamado.id, v)}>
                  <SelectTrigger className="bg-muted"><SelectValue placeholder="Selecionar técnico..." /></SelectTrigger>
                  <SelectContent>
                    {tecnicos.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Change status */}
              <div>
                <label className="text-sm text-foreground/80 mb-1 block">Alterar Status</label>
                <Select onValueChange={v => updateStatus(selectedChamado.id, v)}>
                  <SelectTrigger className="bg-muted"><SelectValue placeholder="Alterar status..." /></SelectTrigger>
                  <SelectContent>
                    {['aguardando', 'aceito', 'a_caminho', 'em_andamento', 'concluido', 'cancelado'].map(s => (
                      <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminChamados;
