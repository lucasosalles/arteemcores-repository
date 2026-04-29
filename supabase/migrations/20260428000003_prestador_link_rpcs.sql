-- ══════════════════════════════════════════════════════════════
-- Atualiza search_prestadores: suporta term vazio (retorna todos)
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.search_prestadores(
  search_term text,
  exclude_condo_id uuid DEFAULT NULL
)
RETURNS TABLE(id uuid, full_name text, email text, phone text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.full_name,
    u.email,
    p.phone
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  JOIN user_roles ur ON ur.user_id = p.id AND ur.role = 'prestador'
  WHERE (
    search_term = ''
    OR p.full_name ILIKE '%' || search_term || '%'
    OR u.email    ILIKE '%' || search_term || '%'
  )
  AND (
    exclude_condo_id IS NULL
    OR p.id NOT IN (
      SELECT pc.prestador_id
      FROM prestador_condominios pc
      WHERE pc.condominio_id = exclude_condo_id
    )
  )
  ORDER BY p.full_name
  LIMIT 50;
$$;

GRANT EXECUTE ON FUNCTION public.search_prestadores(text, uuid) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- RPC: vincular prestador ao condomínio (SECURITY DEFINER)
-- Evita falha silenciosa de RLS e faz a verificação explicitamente
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.link_prestador_to_condo(
  p_prestador_id uuid,
  p_condominio_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verifica que o chamador é síndico deste condomínio
  IF NOT EXISTS (
    SELECT 1 FROM condominios c
    WHERE c.id = p_condominio_id
      AND c.sindico_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Sem permissão: você não é o síndico deste condomínio';
  END IF;

  INSERT INTO prestador_condominios (prestador_id, condominio_id)
  VALUES (p_prestador_id, p_condominio_id)
  ON CONFLICT (prestador_id, condominio_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_prestador_to_condo(uuid, uuid) TO authenticated;

-- ══════════════════════════════════════════════════════════════
-- RPC: desvincular prestador do condomínio (SECURITY DEFINER)
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.unlink_prestador_from_condo(
  p_prestador_id uuid,
  p_condominio_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verifica que o chamador é síndico deste condomínio
  IF NOT EXISTS (
    SELECT 1 FROM condominios c
    WHERE c.id = p_condominio_id
      AND c.sindico_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Sem permissão: você não é o síndico deste condomínio';
  END IF;

  DELETE FROM prestador_condominios
  WHERE prestador_id = p_prestador_id
    AND condominio_id = p_condominio_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unlink_prestador_from_condo(uuid, uuid) TO authenticated;
