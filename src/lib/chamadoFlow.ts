/**
 * chamadoFlow.ts — Lógica centralizada de fluxo de status dos chamados
 *
 * Toda mudança de status passa por aqui:
 *   1. Valida se a transição é permitida para o perfil
 *   2. Atualiza chamados
 *   3. Grava automaticamente em historico_chamados
 */

import { supabase } from '@/integrations/supabase/client';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type AppRole = 'admin' | 'sindico' | 'morador' | 'arquiteto' | 'prestador' | 'tecnico';

export type ChamadoStatus =
  | 'aberto'
  | 'atribuido'
  | 'em_andamento'
  | 'concluido'
  | 'cancelado';

// ─── Mapa de transições permitidas por perfil ────────────────────────────────
//
// Chave: perfil
// Valor: Record<statusAtual, statusNovo[]>
//
// Regras conforme SYNC_SPEC seção 5:
//   sindico    → aberto→atribuido, aberto→cancelado, atribuido→cancelado
//   arquiteto  → atribuido→em_andamento, em_andamento→concluido
//   prestador  → (mesmo que arquiteto)
//   admin      → qualquer transição
//   morador    → sem permissão de mudança de status (apenas abre via abrirChamado)

const TRANSICOES_PERMITIDAS: Partial<Record<AppRole, Record<string, ChamadoStatus[]>>> = {
  sindico: {
    aberto:    ['atribuido', 'cancelado'],
    atribuido: ['cancelado'],
  },
  arquiteto: {
    atribuido:    ['em_andamento'],
    em_andamento: ['concluido'],
    // suporte a status legado do sistema anterior
    aceito:    ['em_andamento'],
    a_caminho: ['em_andamento'],
  },
  prestador: {
    atribuido:    ['em_andamento'],
    em_andamento: ['concluido'],
    aceito:    ['em_andamento'],
    a_caminho: ['em_andamento'],
  },
  admin: {
    aberto:       ['atribuido', 'em_andamento', 'concluido', 'cancelado'],
    atribuido:    ['em_andamento', 'concluido', 'cancelado'],
    em_andamento: ['concluido', 'cancelado'],
    concluido:    ['cancelado'],
  },
};

// ─── Validação ───────────────────────────────────────────────────────────────

export function validarTransicao(
  perfil: AppRole,
  statusAtual: string,
  statusNovo: ChamadoStatus,
): { ok: true } | { ok: false; motivo: string } {
  const regras = TRANSICOES_PERMITIDAS[perfil];
  if (!regras) {
    return { ok: false, motivo: `Perfil "${perfil}" não pode alterar status de chamados.` };
  }
  const permitidos = regras[statusAtual] ?? [];
  if (!permitidos.includes(statusNovo)) {
    return {
      ok: false,
      motivo: `Transição de "${statusAtual}" para "${statusNovo}" não permitida para o perfil "${perfil}".`,
    };
  }
  return { ok: true };
}

// ─── Parâmetros das funções principais ──────────────────────────────────────

export interface AbrirChamadoParams {
  titulo: string;
  tipo: string;
  local: string;
  descricao: string;
  prioridade: string;
  condominioId: string;
  criadoPor: string;
  sindicoId: string;
  observacao?: string;
}

export interface AtribuirChamadoParams {
  chamadoId: string;
  statusAtual: string;
  atribuidoPara: string;
  sindicoId: string;
  observacao?: string;
}

export interface MudarStatusParams {
  chamadoId: string;
  statusAtual: string;
  statusNovo: ChamadoStatus;
  usuarioId: string;
  perfil: AppRole;
  observacao: string;
}

// ─── Resultado padrão ────────────────────────────────────────────────────────

export type FlowResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; erro: string };

// ─── abrirChamado ────────────────────────────────────────────────────────────
//
// Usado por: MoradorChamados, SindicoChamados
// Cria o chamado com status "aberto" e grava o histórico inicial.

export async function abrirChamado(
  params: AbrirChamadoParams,
  perfilAbertura: 'morador' | 'sindico' | 'admin' = 'morador',
): Promise<FlowResult<{ id: string; numero: number }>> {
  const obs = params.observacao
    ?? (perfilAbertura === 'morador' ? 'Chamado aberto pelo morador'
      : perfilAbertura === 'sindico' ? 'Chamado aberto pelo síndico'
      : 'Chamado aberto');

  const { data, error } = await supabase
    .from('chamados')
    .insert({
      titulo: params.titulo,
      tipo: params.tipo as any,
      local: params.local,
      descricao: params.descricao,
      prioridade: params.prioridade as any,
      status: 'aberto' as any,
      criado_por: params.criadoPor,
      sindico_id: params.sindicoId,
      condominio_id: params.condominioId,
      data_abertura: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return { ok: false, erro: error.message };
  }

  const { error: histError } = await supabase.from('historico_chamados').insert({
    chamado_id: data.id,
    usuario_id: params.criadoPor,
    status_anterior: '',
    status_novo: 'aberto',
    observacao: obs,
  });

  if (histError) {
    console.error('[chamadoFlow] Erro ao gravar histórico na abertura:', histError.message);
  }

  // ─── Verificação de plano ────────────────────────────────────────────────
  let foraDoPlano = false;
  const { data: condoData } = await supabase
    .from('condominios')
    .select('atendimentos_mes, limite_atendimentos')
    .eq('id', params.condominioId)
    .maybeSingle();

  if (condoData) {
    foraDoPlano = (condoData.atendimentos_mes ?? 0) >= (condoData.limite_atendimentos ?? 999);
    await supabase
      .from('condominios')
      .update({ atendimentos_mes: (condoData.atendimentos_mes ?? 0) + 1 })
      .eq('id', params.condominioId);

    if (foraDoPlano) {
      await supabase.from('orcamentos').insert({
        chamado_id: data.id,
        condominio_id: params.condominioId,
        solicitante_id: params.criadoPor,
        titulo: params.titulo,
        tipo: params.tipo,
        descricao: `Serviço fora do plano vinculado ao chamado #${data.numero}. ${params.descricao}`,
        status: 'enviado',
        dentro_do_plano: false,
      });
    }
  }

  return { ok: true, data: { id: data.id, numero: data.numero, foraDoPlano } };
}

// ─── atribuirChamado ─────────────────────────────────────────────────────────
//
// Usado por: SindicoDashboard
// Atribui o chamado a um executor e muda status para "atribuido".

export async function atribuirChamado(
  params: AtribuirChamadoParams,
): Promise<FlowResult> {
  const validacao = validarTransicao('sindico', params.statusAtual, 'atribuido');
  if (!validacao.ok) {
    return { ok: false, erro: validacao.motivo };
  }

  const { error } = await supabase
    .from('chamados')
    .update({ atribuido_para: params.atribuidoPara, status: 'atribuido' as any })
    .eq('id', params.chamadoId);

  if (error) {
    return { ok: false, erro: error.message };
  }

  const obs = params.observacao ?? 'Chamado atribuído pelo síndico';
  const { error: histError } = await supabase.from('historico_chamados').insert({
    chamado_id: params.chamadoId,
    usuario_id: params.sindicoId,
    status_anterior: params.statusAtual,
    status_novo: 'atribuido',
    observacao: obs,
  });

  if (histError) {
    console.error('[chamadoFlow] Erro ao gravar histórico na atribuição:', histError.message);
  }

  return { ok: true, data: undefined };
}

// ─── mudarStatusChamado ──────────────────────────────────────────────────────
//
// Usado por: ArquitetoDashboard (e PrestadorDashboard via reexport)
// Valida a transição, atualiza o chamado e grava o histórico.

export async function mudarStatusChamado(
  params: MudarStatusParams,
): Promise<FlowResult> {
  const validacao = validarTransicao(params.perfil, params.statusAtual, params.statusNovo);
  if (!validacao.ok) {
    return { ok: false, erro: validacao.motivo };
  }

  const updateData: Record<string, any> = { status: params.statusNovo };
  if (params.statusNovo === 'concluido') {
    const now = new Date().toISOString();
    updateData.data_conclusao = now;
    updateData.concluded_at = now;
    updateData.observacoes_tecnico = params.observacao;
  }

  const { error } = await supabase
    .from('chamados')
    .update(updateData)
    .eq('id', params.chamadoId);

  if (error) {
    return { ok: false, erro: error.message };
  }

  const { error: histError } = await supabase.from('historico_chamados').insert({
    chamado_id: params.chamadoId,
    usuario_id: params.usuarioId,
    status_anterior: params.statusAtual,
    status_novo: params.statusNovo,
    observacao: params.observacao,
  });

  if (histError) {
    console.error('[chamadoFlow] Erro ao gravar histórico na mudança de status:', histError.message);
  }

  return { ok: true, data: undefined };
}

// ─── statusDisponiveis ────────────────────────────────────────────────────────
//
// Retorna os próximos status possíveis para um perfil dado o status atual.
// Útil para popular dropdowns nos modais.

export function statusDisponiveis(
  perfil: AppRole,
  statusAtual: string,
): ChamadoStatus[] {
  return TRANSICOES_PERMITIDAS[perfil]?.[statusAtual] ?? [];
}

// ─── criarOrcamentoParaChamado ────────────────────────────────────────────────
//
// Usado por: SindicoChamados (ação manual "Adicionar Serviço Extra")
// Cria um orçamento vinculado a um chamado existente como serviço fora do plano.

export interface CriarOrcamentoParaChamadoParams {
  chamadoId: string;
  condominioId: string;
  titulo: string;
  tipo: string;
  descricao: string;
  solicitanteId: string;
  numeroChamado: number;
}

export async function criarOrcamentoParaChamado(
  params: CriarOrcamentoParaChamadoParams,
): Promise<FlowResult<{ orcamentoId: string }>> {
  const { data, error } = await supabase
    .from('orcamentos')
    .insert({
      chamado_id: params.chamadoId,
      condominio_id: params.condominioId,
      solicitante_id: params.solicitanteId,
      titulo: params.titulo,
      tipo: params.tipo,
      descricao: params.descricao || `Serviço extra vinculado ao chamado #${params.numeroChamado}`,
      status: 'enviado',
      dentro_do_plano: false,
    })
    .select('id')
    .single();

  if (error) {
    return { ok: false, erro: error.message };
  }

  return { ok: true, data: { orcamentoId: data.id } };
}
