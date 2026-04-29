import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X, Building2, FileText } from 'lucide-react';

const STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho', enviado: 'Enviado', em_analise: 'Em análise',
  aprovado: 'Aprovado', recusado: 'Recusado', em_execucao: 'Em execução',
  concluido: 'Concluído', cancelado: 'Cancelado',
};

const STATUS_STYLE: Record<string, string> = {
  rascunho: 'bg-muted/50 text-muted-foreground',
  enviado: 'bg-blue-500/20 text-blue-400',
  em_analise: 'bg-warning/20 text-warning',
  aprovado: 'bg-success/20 text-success',
  recusado: 'bg-muted/50 text-muted-foreground',
  em_execucao: 'bg-orange-500/20 text-orange-400',
  concluido: 'bg-emerald-500/20 text-emerald-400',
  cancelado: 'bg-muted/50 text-muted-foreground',
};

interface Orcamento {
  id: string;
  titulo: string;
  status: string;
  data_solicitacao: string;
  condominio_id: string;
  condominio_name: string;
  prestador_name: string | null;
  valor_aprovado: number | null;
}

interface Cliente {
  id: string;
  name: string;
  totalOrcamentos: number;
  ultimoOrcamento: string;
  orcamentos: Orcamento[];
}

export default function ArquitetoClientes() {
  const { profile } = useAuth();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [detalhe, setDetalhe] = useState<Cliente | null>(null);

  const fetchClientes = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data } = await supabase.rpc('get_arquiteto_orcamentos', { p_arquiteto_id: profile.id });
    const orcs: Orcamento[] = data || [];

    // Group by condominio_id
    const map = new Map<string, Cliente>();
    for (const o of orcs) {
      if (!o.condominio_id || !o.condominio_name) continue;
      if (!map.has(o.condominio_id)) {
        map.set(o.condominio_id, {
          id: o.condominio_id,
          name: o.condominio_name,
          totalOrcamentos: 0,
          ultimoOrcamento: o.data_solicitacao,
          orcamentos: [],
        });
      }
      const c = map.get(o.condominio_id)!;
      c.totalOrcamentos++;
      c.orcamentos.push(o);
      if (new Date(o.data_solicitacao) > new Date(c.ultimoOrcamento)) {
        c.ultimoOrcamento = o.data_solicitacao;
      }
    }

    // Sort clientes by most recent
    const sorted = Array.from(map.values()).sort(
      (a, b) => new Date(b.ultimoOrcamento).getTime() - new Date(a.ultimoOrcamento).getTime()
    );
    setClientes(sorted);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => { fetchClientes(); }, [fetchClientes]);

  const filtered = clientes.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
        <p className="text-muted-foreground">Condomínios com orçamentos vinculados a você</p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar condomínio..." className="pl-9" value={search}
          onChange={e => setSearch(e.target.value)} />
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-20 bg-card rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-10 text-center text-muted-foreground text-sm">
          {search ? 'Nenhum cliente encontrado.' : 'Nenhum cliente ainda.'}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <div key={c.id}
              className="glass-card p-4 flex items-center justify-between gap-4 cursor-pointer hover:bg-muted/10 transition-colors"
              onClick={() => setDetalhe(c)}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Último orçamento: {new Date(c.ultimoOrcamento).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-lg font-bold text-foreground">{c.totalOrcamentos}</p>
                <p className="text-xs text-muted-foreground">orçamento{c.totalOrcamentos !== 1 ? 's' : ''}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detalhe Modal */}
      {detalhe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-foreground truncate">{detalhe.name}</h2>
                <p className="text-xs text-muted-foreground">{detalhe.totalOrcamentos} orçamento{detalhe.totalOrcamentos !== 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => setDetalhe(null)} className="text-muted-foreground hover:text-foreground ml-3 shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 p-5 space-y-3">
              {detalhe.orcamentos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum orçamento.</p>
              ) : (
                detalhe.orcamentos
                  .slice()
                  .sort((a, b) => new Date(b.data_solicitacao).getTime() - new Date(a.data_solicitacao).getTime())
                  .map(o => (
                    <div key={o.id} className="p-3 rounded-lg bg-muted/30 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{o.titulo}</p>
                          {o.prestador_name && (
                            <p className="text-xs text-muted-foreground">Prestador: {o.prestador_name}</p>
                          )}
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${STATUS_STYLE[o.status] ?? 'bg-muted/50 text-muted-foreground'}`}>
                          {STATUS_LABEL[o.status] ?? o.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{new Date(o.data_solicitacao).toLocaleDateString('pt-BR')}</span>
                        {o.valor_aprovado != null && (
                          <span className="text-success font-medium">R$ {o.valor_aprovado.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>

            <div className="p-4 border-t border-border shrink-0">
              <Button variant="outline" className="w-full" onClick={() => setDetalhe(null)}>Fechar</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
