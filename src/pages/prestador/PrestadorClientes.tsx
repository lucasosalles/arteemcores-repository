import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Users } from 'lucide-react';

interface Cliente {
  id: string;
  nome: string;
  tipo: 'Morador' | 'Condomínio';
  condo_nome: string | null;
  total: number;
  ultimo_servico: string | null;
  chamados: any[];
  orcamentos: any[];
}

const STATUS_CLS: Record<string, string> = {
  aberto: 'bg-warning/20 text-warning', atribuido: 'bg-blue-500/20 text-blue-400',
  em_andamento: 'bg-orange-500/20 text-orange-400', concluido: 'bg-success/20 text-success',
  cancelado: 'bg-muted text-muted-foreground', enviado: 'bg-blue-500/20 text-blue-400',
  em_analise: 'bg-warning/20 text-warning', em_execucao: 'bg-purple-500/20 text-purple-400',
  aprovado: 'bg-success/20 text-success', recusado: 'bg-destructive/20 text-destructive',
};

export default function PrestadorClientes() {
  const { profile } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [selected, setSelected] = useState<Cliente | null>(null);

  const fetchClientes = useCallback(async () => {
    if (!profile?.id) return;

    const [chamRes, orcRes] = await Promise.all([
      supabase.from('chamados')
        .select('id, titulo, local, tipo, status, data_abertura, created_at, condominio_id, condominios(id, name)')
        .eq('atribuido_para', profile.id),
      supabase.from('orcamentos')
        .select('id, titulo, tipo, status, data_solicitacao, valor_proposto, solicitante_id, profiles!orcamentos_solicitante_id_fkey(id, full_name), condominio_id, condominios(name)')
        .eq('prestador_id', profile.id),
    ]);

    const chamados = chamRes.data || [];
    const orcamentos = orcRes.data || [];

    // Map condomínio clients (from chamados)
    const condoMap = new Map<string, Cliente>();
    for (const c of chamados) {
      const condo = (c as any).condominios;
      if (!condo?.id) continue;
      if (!condoMap.has(condo.id)) {
        condoMap.set(condo.id, {
          id: condo.id,
          nome: condo.name,
          tipo: 'Condomínio',
          condo_nome: condo.name,
          total: 0,
          ultimo_servico: null,
          chamados: [],
          orcamentos: [],
        });
      }
      const cl = condoMap.get(condo.id)!;
      cl.chamados.push(c);
      cl.total++;
      const d = c.data_abertura || c.created_at;
      if (!cl.ultimo_servico || d > cl.ultimo_servico) cl.ultimo_servico = d;
    }

    // Map morador/solicitante clients (from orcamentos)
    const moradorMap = new Map<string, Cliente>();
    for (const o of orcamentos) {
      const p = (o as any).profiles;
      if (!p?.id) continue;
      if (!moradorMap.has(p.id)) {
        const condoNome = (o as any).condominios?.name ?? null;
        moradorMap.set(p.id, {
          id: p.id,
          nome: p.full_name,
          tipo: 'Morador',
          condo_nome: condoNome,
          total: 0,
          ultimo_servico: null,
          chamados: [],
          orcamentos: [],
        });
      }
      const cl = moradorMap.get(p.id)!;
      cl.orcamentos.push(o);
      cl.total++;
      const d = o.data_solicitacao;
      if (d && (!cl.ultimo_servico || d > cl.ultimo_servico)) cl.ultimo_servico = d;
    }

    const todos = [...Array.from(condoMap.values()), ...Array.from(moradorMap.values())];
    todos.sort((a, b) => (b.ultimo_servico ?? '') > (a.ultimo_servico ?? '') ? 1 : -1);
    setClientes(todos);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { fetchClientes(); }, [fetchClientes]);

  const filtered = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
        <p className="text-muted-foreground">Moradores e condomínios atendidos</p>
      </div>

      {/* Busca */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome..."
          className="pl-10 bg-card"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-card rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>{clientes.length === 0 ? 'Nenhum cliente encontrado ainda.' : 'Nenhum cliente corresponde à busca.'}</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-4 text-muted-foreground font-medium">Nome</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Tipo</th>
                  <th className="text-left p-4 text-muted-foreground font-medium hidden md:table-cell">Condomínio</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Serviços</th>
                  <th className="text-left p-4 text-muted-foreground font-medium hidden sm:table-cell">Último serviço</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr
                    key={c.id}
                    className="border-b border-border/50 hover:bg-muted/20 cursor-pointer"
                    onClick={() => setSelected(c)}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground shrink-0">
                          {c.nome.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-foreground">{c.nome}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        c.tipo === 'Condomínio' ? 'bg-blue-500/20 text-blue-400' : 'bg-secondary/20 text-secondary'
                      }`}>
                        {c.tipo}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground hidden md:table-cell">{c.condo_nome ?? '—'}</td>
                    <td className="p-4 text-foreground font-semibold">{c.total}</td>
                    <td className="p-4 text-muted-foreground text-xs hidden sm:table-cell">
                      {c.ultimo_servico ? new Date(c.ultimo_servico).toLocaleDateString('pt-BR') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Histórico */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              {selected?.nome}
              {selected && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  selected.tipo === 'Condomínio' ? 'bg-blue-500/20 text-blue-400' : 'bg-secondary/20 text-secondary'
                }`}>
                  {selected.tipo}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              {selected.chamados.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Chamados ({selected.chamados.length})
                  </h3>
                  <div className="space-y-2">
                    {selected.chamados.map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 text-sm">
                        <div>
                          <p className="font-medium text-foreground">{c.titulo || c.local}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(c.data_abertura || c.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_CLS[c.status] ?? 'bg-muted text-muted-foreground'}`}>
                          {c.status.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selected.orcamentos.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Orçamentos ({selected.orcamentos.length})
                  </h3>
                  <div className="space-y-2">
                    {selected.orcamentos.map((o: any) => (
                      <div key={o.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 text-sm">
                        <div>
                          <p className="font-medium text-foreground">{o.titulo}</p>
                          <p className="text-xs text-muted-foreground">
                            {o.data_solicitacao ? new Date(o.data_solicitacao).toLocaleDateString('pt-BR') : '—'}
                            {o.valor_proposto ? ` · R$ ${o.valor_proposto.toFixed(2)}` : ''}
                          </p>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_CLS[o.status] ?? 'bg-muted text-muted-foreground'}`}>
                          {o.status.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selected.chamados.length === 0 && selected.orcamentos.length === 0 && (
                <p className="text-center text-muted-foreground py-4">Nenhum histórico disponível.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
