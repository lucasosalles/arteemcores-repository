import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Bell } from 'lucide-react';

interface Notificacao {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  lida: boolean;
  link: string | null;
  created_at: string;
}

export default function NotificationBell() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [open, setOpen] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const naoLidas = notificacoes.filter(n => !n.lida).length;

  const fetchNotificacoes = async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('usuario_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(5);
    setNotificacoes((data as Notificacao[]) || []);
  };

  useEffect(() => {
    if (!profile?.id) return;

    fetchNotificacoes();

    // Realtime subscription
    channelRef.current = supabase
      .channel(`notificacoes:${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notificacoes',
          filter: `usuario_id=eq.${profile.id}`,
        },
        (payload) => {
          setNotificacoes(prev => {
            const nova = payload.new as Notificacao;
            return [nova, ...prev].slice(0, 5);
          });
        },
      )
      .subscribe();

    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [profile?.id]);

  const handleClick = async (notif: Notificacao) => {
    if (!notif.lida) {
      await supabase
        .from('notificacoes')
        .update({ lida: true })
        .eq('id', notif.id);
      setNotificacoes(prev =>
        prev.map(n => (n.id === notif.id ? { ...n, lida: true } : n)),
      );
    }
    if (notif.link) {
      navigate(notif.link);
    }
    setOpen(false);
  };

  const marcarTodasLidas = async () => {
    const ids = notificacoes.filter(n => !n.lida).map(n => n.id);
    if (ids.length === 0) return;
    await supabase.from('notificacoes').update({ lida: true }).in('id', ids);
    setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
  };

  const TIPO_ICON: Record<string, string> = {
    chamado: '📋', orcamento: '📄', pagamento: '💳', sistema: '🔔',
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground">
          <Bell className="w-5 h-5" />
          {naoLidas > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {naoLidas > 9 ? '9+' : naoLidas}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-80 p-0 bg-card border-border"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold text-foreground">Notificações</span>
          {naoLidas > 0 && (
            <button
              onClick={marcarTodasLidas}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Marcar todas como lidas
            </button>
          )}
        </div>

        {/* List */}
        {notificacoes.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            Nenhuma notificação ainda.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {notificacoes.map(n => (
              <li key={n.id}>
                <button
                  onClick={() => handleClick(n)}
                  className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex gap-3 items-start ${
                    !n.lida ? 'bg-primary/5' : ''
                  }`}
                >
                  <span className="text-lg shrink-0 mt-0.5">
                    {TIPO_ICON[n.tipo] ?? '🔔'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm truncate ${!n.lida ? 'font-semibold text-foreground' : 'text-foreground/80'}`}>
                      {n.titulo}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {n.mensagem}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(n.created_at).toLocaleString('pt-BR', {
                        day: '2-digit', month: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  {!n.lida && (
                    <span className="w-2 h-2 rounded-full bg-secondary shrink-0 mt-1.5" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
