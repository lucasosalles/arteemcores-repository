-- Função RPC para buscar prestadores por nome ou email
-- SECURITY DEFINER permite acessar auth.users (restrito ao service role)
-- Exclui prestadores já vinculados ao condomínio informado

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
    p.full_name ILIKE '%' || search_term || '%'
    OR u.email   ILIKE '%' || search_term || '%'
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
  LIMIT 10;
$$;

-- Garante que apenas usuários autenticados possam chamar a função
GRANT EXECUTE ON FUNCTION public.search_prestadores(text, uuid) TO authenticated;
