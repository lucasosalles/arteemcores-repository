/**
 * notificacoes.ts — Helper para criar notificações
 *
 * Para notificações simples (só banco, sem email):
 *   await criarNotificacao({ usuario_id, titulo, mensagem, tipo })
 *
 * Para notificações com email transacional:
 *   await enviarNotificacao({ usuario_id, titulo, mensagem, tipo, link })
 */

import { supabase } from '@/integrations/supabase/client';

export type TipoNotificacao = 'chamado' | 'orcamento' | 'pagamento' | 'sistema';

export interface NotificacaoParams {
  usuario_id: string;
  titulo: string;
  mensagem: string;
  tipo: TipoNotificacao;
  link?: string;
}

/** Insere notificação direto no banco (sem email). */
export async function criarNotificacao(params: NotificacaoParams): Promise<void> {
  const { error } = await supabase.from('notificacoes').insert({
    usuario_id: params.usuario_id,
    titulo: params.titulo,
    mensagem: params.mensagem,
    tipo: params.tipo,
    lida: false,
    link: params.link ?? null,
  });
  if (error) {
    console.error('[notificacoes] Erro ao criar notificação:', error.message);
  }
}

/** Chama a Edge Function send-notification (banco + email). */
export async function enviarNotificacao(params: NotificacaoParams): Promise<void> {
  const { error } = await supabase.functions.invoke('send-notification', {
    body: params,
  });
  if (error) {
    console.error('[notificacoes] Erro ao enviar notificação:', error.message);
  }
}
