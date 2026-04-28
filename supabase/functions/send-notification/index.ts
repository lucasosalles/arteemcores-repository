// Supabase Edge Function — send-notification
// Envia email transacional e insere registro na tabela notificacoes.
//
// POST body:
//   usuario_id  string   — UUID do destinatário (profiles)
//   titulo      string   — assunto resumido
//   mensagem    string   — corpo da notificação
//   tipo        string   — chamado | orcamento | pagamento | sistema
//   link?       string   — rota interna opcional (ex: /sindico/orcamentos)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { usuario_id, titulo, mensagem, tipo = 'sistema', link } = await req.json();

    if (!usuario_id || !titulo || !mensagem) {
      return new Response(
        JSON.stringify({ error: 'usuario_id, titulo e mensagem são obrigatórios' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    // 1. Insere notificação no banco
    const { error: dbError } = await supabase.from('notificacoes').insert({
      usuario_id,
      titulo,
      mensagem,
      tipo,
      lida: false,
      link: link ?? null,
    });

    if (dbError) {
      console.error('[send-notification] DB insert error:', dbError.message);
      return new Response(
        JSON.stringify({ error: dbError.message }),
        { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    // 2. Busca email do usuário via auth.users
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(usuario_id);

    if (userError || !userData?.user?.email) {
      // Notificação no banco já foi criada — apenas loga o erro de email
      console.warn('[send-notification] Usuário sem email, apenas notificação no banco criada.');
      return new Response(
        JSON.stringify({ ok: true, email_sent: false }),
        { headers: { ...CORS, 'Content-Type': 'application/json' } },
      );
    }

    const email = userData.user.email;

    // 3. Envia email via Supabase SMTP (Auth email)
    const emailBody = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;background:#0f0f0f;color:#e5e5e5;margin:0;padding:32px">
  <div style="max-width:520px;margin:0 auto;background:#1a1a1a;border-radius:12px;overflow:hidden">
    <div style="background:linear-gradient(135deg,#b8860b,#ffd700);padding:24px 32px">
      <h1 style="margin:0;font-size:20px;color:#0f0f0f;font-weight:800">Fino Haus</h1>
    </div>
    <div style="padding:32px">
      <h2 style="margin:0 0 12px;font-size:18px;color:#e5e5e5">${titulo}</h2>
      <p style="margin:0 0 24px;color:#a3a3a3;line-height:1.6">${mensagem}</p>
      ${link ? `<a href="${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '') ?? ''}${link}"
        style="display:inline-block;background:linear-gradient(135deg,#b8860b,#ffd700);color:#0f0f0f;
        font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none">
        Ver detalhes
      </a>` : ''}
    </div>
    <div style="padding:16px 32px;border-top:1px solid #2a2a2a">
      <p style="margin:0;font-size:12px;color:#666">
        Este email foi enviado automaticamente pelo sistema Fino Haus. Não responda.
      </p>
    </div>
  </div>
</body>
</html>`;

    const { error: emailError } = await supabase.auth.admin.sendRawEmail({
      email,
      subject: `[Fino Haus] ${titulo}`,
      html: emailBody,
    } as any);

    if (emailError) {
      console.warn('[send-notification] Email error (notificação no banco já criada):', emailError.message);
    }

    return new Response(
      JSON.stringify({ ok: true, email_sent: !emailError }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[send-notification] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Erro interno' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  }
});
