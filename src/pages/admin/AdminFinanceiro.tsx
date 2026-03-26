import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { DollarSign, TrendingUp } from 'lucide-react';

const AdminFinanceiro: React.FC = () => {
  const [pagamentos, setPagamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mrr, setMrr] = useState(0);

  useEffect(() => {
    const fetch = async () => {
      const [pagRes, condoRes] = await Promise.all([
        supabase.from('pagamentos').select('*, condominios(name)').order('vencimento', { ascending: false }),
        supabase.from('condominios').select('plano').eq('ativo', true),
      ]);
      setPagamentos(pagRes.data || []);
      const planoPrecos: Record<string, number> = { essencial: 490, profissional: 890, premium: 1490 };
      setMrr((condoRes.data || []).reduce((s, c) => s + (planoPrecos[c.plano] || 0), 0));
      setLoading(false);
    };
    fetch();
  }, []);

  const markPaid = async (id: string) => {
    const { error } = await supabase.from('pagamentos').update({ status: 'pago' as any }).eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Marcado como pago!'); setPagamentos(prev => prev.map(p => p.id === id ? { ...p, status: 'pago' } : p)); }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      pago: { label: 'Pago', cls: 'bg-success/20 text-success' },
      pendente: { label: 'Pendente', cls: 'bg-warning/20 text-warning' },
      atrasado: { label: 'Atrasado', cls: 'bg-destructive/20 text-destructive' },
    };
    const s = map[status] || { label: status, cls: '' };
    return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>;
  };

  if (loading) return <div className="p-6 lg:p-8"><div className="h-64 bg-card rounded-xl animate-pulse" /></div>;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Financeiro</h1>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="glass-card p-6">
          <DollarSign className="w-6 h-6 text-secondary mb-2" />
          <p className="text-3xl font-bold text-foreground">R$ {mrr.toLocaleString('pt-BR')}</p>
          <p className="text-sm text-muted-foreground">MRR (Receita Mensal)</p>
        </div>
        <div className="glass-card p-6">
          <TrendingUp className="w-6 h-6 text-success mb-2" />
          <p className="text-3xl font-bold text-foreground">R$ {(mrr * 12).toLocaleString('pt-BR')}</p>
          <p className="text-sm text-muted-foreground">ARR (Receita Anual)</p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left p-3 text-muted-foreground font-medium">Condomínio</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Mês</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Valor</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Vencimento</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Status</th>
                <th className="text-left p-3 text-muted-foreground font-medium">Ação</th>
              </tr>
            </thead>
            <tbody>
              {pagamentos.map(p => (
                <tr key={p.id} className="border-b border-border/50">
                  <td className="p-3 text-foreground">{p.condominios?.name}</td>
                  <td className="p-3 text-muted-foreground">{p.mes_referencia}</td>
                  <td className="p-3 text-foreground font-semibold">R$ {Number(p.valor).toLocaleString('pt-BR')}</td>
                  <td className="p-3 text-muted-foreground">{new Date(p.vencimento).toLocaleDateString('pt-BR')}</td>
                  <td className="p-3">{statusBadge(p.status)}</td>
                  <td className="p-3">
                    {p.status !== 'pago' && (
                      <Button variant="success" size="sm" onClick={() => markPaid(p.id)}>Marcar Pago</Button>
                    )}
                  </td>
                </tr>
              ))}
              {pagamentos.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nenhum pagamento registrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminFinanceiro;
