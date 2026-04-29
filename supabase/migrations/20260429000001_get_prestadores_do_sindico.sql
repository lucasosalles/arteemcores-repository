-- Retorna todos os prestadores vinculados aos condomínios de um síndico,
-- com dados de disponibilidade. SECURITY DEFINER para bypassar RLS de profiles.

CREATE OR REPLACE FUNCTION public.get_prestadores_do_sindico(
  p_sindico_id uuid
)
RETURNS TABLE(
  prestador_id              uuid,
  condominio_id             uuid,
  full_name                 text,
  phone                     text,
  disponivel                boolean,
  especialidades            text[],
  tempo_medio_execucao_dias integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id                            AS prestador_id,
    pc.condominio_id,
    p.full_name,
    p.phone,
    dp.disponivel,
    dp.especialidades,
    dp.tempo_medio_execucao_dias
  FROM condominios c
  JOIN prestador_condominios pc ON pc.condominio_id = c.id
  JOIN profiles p               ON p.id = pc.prestador_id
  LEFT JOIN disponibilidade_prestador dp ON dp.prestador_id = pc.prestador_id
  WHERE c.sindico_id = p_sindico_id
  ORDER BY p.full_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_prestadores_do_sindico(uuid) TO authenticated;
