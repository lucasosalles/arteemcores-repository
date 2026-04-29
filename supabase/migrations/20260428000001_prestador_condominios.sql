-- Tabela de vínculo explícito entre prestadores e condomínios
-- Permite ao síndico adicionar/remover prestadores do seu condomínio

CREATE TABLE IF NOT EXISTS prestador_condominios (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  condominio_id  uuid        NOT NULL REFERENCES condominios(id) ON DELETE CASCADE,
  created_at     timestamptz DEFAULT now(),
  UNIQUE (prestador_id, condominio_id)
);

ALTER TABLE prestador_condominios ENABLE ROW LEVEL SECURITY;

-- Todos autenticados podem ler (síndico precisa ler para exibir a lista)
CREATE POLICY "prestador_condominios_select_auth" ON prestador_condominios
  FOR SELECT USING (auth.role() = 'authenticated');

-- Síndico pode inserir vínculos nos seus condomínios
CREATE POLICY "prestador_condominios_insert_sindico" ON prestador_condominios
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM condominios c
      WHERE c.id = prestador_condominios.condominio_id
        AND c.sindico_id = auth.uid()
    )
  );

-- Síndico pode remover vínculos nos seus condomínios
CREATE POLICY "prestador_condominios_delete_sindico" ON prestador_condominios
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM condominios c
      WHERE c.id = prestador_condominios.condominio_id
        AND c.sindico_id = auth.uid()
    )
  );

-- Admin pode tudo
CREATE POLICY "prestador_condominios_admin_all" ON prestador_condominios
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
