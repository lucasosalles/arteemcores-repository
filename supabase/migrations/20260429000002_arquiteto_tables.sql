-- ══════════════════════════════════════════════════════════════
-- Tabela: arquiteto_prestadores
-- Vínculo direto entre arquiteto e prestador (independente de condo)
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS arquiteto_prestadores (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arquiteto_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  prestador_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at     timestamptz DEFAULT now(),
  UNIQUE (arquiteto_id, prestador_id)
);

ALTER TABLE arquiteto_prestadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arquiteto_prestadores_select" ON arquiteto_prestadores
  FOR SELECT USING (auth.uid() = arquiteto_id OR auth.uid() = prestador_id);

CREATE POLICY "arquiteto_prestadores_insert" ON arquiteto_prestadores
  FOR INSERT WITH CHECK (auth.uid() = arquiteto_id);

CREATE POLICY "arquiteto_prestadores_delete" ON arquiteto_prestadores
  FOR DELETE USING (auth.uid() = arquiteto_id);

-- ══════════════════════════════════════════════════════════════
-- Tabela: portfolio_arquiteto
-- Vitrine de projetos/serviços do arquiteto
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS portfolio_arquiteto (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  arquiteto_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  titulo         text NOT NULL,
  descricao      text,
  tipo           text CHECK (tipo IN ('reparo','arquitetura','limpeza','seguranca','pintura','eletrica','hidraulica','jardinagem','outro')),
  foto_url       text,
  data_conclusao date,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE portfolio_arquiteto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "portfolio_select_all" ON portfolio_arquiteto
  FOR SELECT USING (true);

CREATE POLICY "portfolio_insert_arquiteto" ON portfolio_arquiteto
  FOR INSERT WITH CHECK (auth.uid() = arquiteto_id);

CREATE POLICY "portfolio_update_arquiteto" ON portfolio_arquiteto
  FOR UPDATE USING (auth.uid() = arquiteto_id);

CREATE POLICY "portfolio_delete_arquiteto" ON portfolio_arquiteto
  FOR DELETE USING (auth.uid() = arquiteto_id);

-- ══════════════════════════════════════════════════════════════
-- RPC: get_arquiteto_orcamentos
-- Retorna orçamentos do arquiteto com nome do prestador e do condomínio
-- SECURITY DEFINER para acessar profiles e condominios sem RLS
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_arquiteto_orcamentos(p_arquiteto_id uuid)
RETURNS TABLE(
  id                uuid,
  titulo            text,
  tipo              text,
  status            text,
  valor_proposto    numeric,
  valor_aprovado    numeric,
  prazo_dias        int,
  observacoes       text,
  data_solicitacao  timestamptz,
  data_conclusao    timestamptz,
  condominio_id     uuid,
  condominio_name   text,
  prestador_id      uuid,
  prestador_name    text,
  created_at        timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id, o.titulo, o.tipo, o.status,
    o.valor_proposto, o.valor_aprovado, o.prazo_dias,
    o.observacoes,
    o.data_solicitacao, o.data_conclusao,
    o.condominio_id, c.name AS condominio_name,
    o.prestador_id, p.full_name AS prestador_name,
    o.created_at
  FROM orcamentos o
  LEFT JOIN condominios c ON c.id = o.condominio_id
  LEFT JOIN profiles p    ON p.id = o.prestador_id
  WHERE o.solicitante_id = p_arquiteto_id
  ORDER BY o.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_arquiteto_orcamentos(uuid) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- RPC: get_prestadores_do_arquiteto
-- Retorna prestadores vinculados ao arquiteto via arquiteto_prestadores
-- com dados de disponibilidade e total de orçamentos juntos
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_prestadores_do_arquiteto(p_arquiteto_id uuid)
RETURNS TABLE(
  prestador_id              uuid,
  full_name                 text,
  phone                     text,
  disponivel                boolean,
  especialidades            text[],
  tempo_medio_execucao_dias int,
  total_orcamentos          bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS prestador_id,
    p.full_name,
    p.phone,
    dp.disponivel,
    dp.especialidades,
    dp.tempo_medio_execucao_dias,
    COUNT(o.id) AS total_orcamentos
  FROM arquiteto_prestadores ap
  JOIN profiles p ON p.id = ap.prestador_id
  LEFT JOIN disponibilidade_prestador dp ON dp.prestador_id = ap.prestador_id
  LEFT JOIN orcamentos o
    ON o.prestador_id = ap.prestador_id
    AND o.solicitante_id = p_arquiteto_id
  WHERE ap.arquiteto_id = p_arquiteto_id
  GROUP BY p.id, p.full_name, p.phone,
           dp.disponivel, dp.especialidades, dp.tempo_medio_execucao_dias
  ORDER BY p.full_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_prestadores_do_arquiteto(uuid) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- RPC: search_prestadores_for_arquiteto
-- Busca prestadores por nome ou email, excluindo já vinculados ao arquiteto
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.search_prestadores_for_arquiteto(
  p_arquiteto_id uuid,
  search_term    text
)
RETURNS TABLE(id uuid, full_name text, email text, phone text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, u.email, p.phone
  FROM profiles p
  JOIN auth.users u  ON u.id = p.id
  JOIN user_roles ur ON ur.user_id = p.id AND ur.role = 'prestador'
  WHERE (
    search_term = ''
    OR p.full_name ILIKE '%' || search_term || '%'
    OR u.email    ILIKE '%' || search_term || '%'
  )
  AND p.id NOT IN (
    SELECT ap.prestador_id
    FROM arquiteto_prestadores ap
    WHERE ap.arquiteto_id = p_arquiteto_id
  )
  ORDER BY p.full_name
  LIMIT 20;
$$;

GRANT EXECUTE ON FUNCTION public.search_prestadores_for_arquiteto(uuid, text) TO authenticated;
