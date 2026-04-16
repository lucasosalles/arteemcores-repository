-- SYNC_SPEC v2 — Fino Haus
-- Novos perfis, enums atualizados, tabelas unidades e historico_chamados

-- 1. Novos valores no enum app_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'morador';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'arquiteto';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'prestador';

-- 2. Novos tipos de chamado
ALTER TYPE chamado_tipo ADD VALUE IF NOT EXISTS 'reparo';
ALTER TYPE chamado_tipo ADD VALUE IF NOT EXISTS 'arquitetura';
ALTER TYPE chamado_tipo ADD VALUE IF NOT EXISTS 'limpeza';
ALTER TYPE chamado_tipo ADD VALUE IF NOT EXISTS 'seguranca';
ALTER TYPE chamado_tipo ADD VALUE IF NOT EXISTS 'outro';

-- 3. Novos status de chamado
ALTER TYPE chamado_status ADD VALUE IF NOT EXISTS 'aberto';
ALTER TYPE chamado_status ADD VALUE IF NOT EXISTS 'atribuido';

-- 4. Novos valores de prioridade
ALTER TYPE chamado_prioridade ADD VALUE IF NOT EXISTS 'baixa';
ALTER TYPE chamado_prioridade ADD VALUE IF NOT EXISTS 'media';

-- 5. Tabela unidades
CREATE TABLE IF NOT EXISTS unidades (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  numero        text        NOT NULL,
  bloco         text,
  tipo          text        DEFAULT 'apartamento'
                            CHECK (tipo IN ('apartamento', 'casa', 'loja', 'vaga')),
  condominio_id uuid        REFERENCES condominios(id) ON DELETE CASCADE,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE unidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unidades_select" ON unidades
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "unidades_insert" ON unidades
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "unidades_update" ON unidades
  FOR UPDATE USING (auth.role() = 'authenticated');

-- 6. Novas colunas na tabela chamados
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS titulo          text;
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS criado_por      uuid REFERENCES profiles(id);
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS atribuido_para  uuid REFERENCES profiles(id);
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS unidade_id      uuid REFERENCES unidades(id);
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS data_abertura   timestamptz DEFAULT now();
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS data_conclusao  timestamptz;
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS foto_url        text;

-- 7. Tabela historico_chamados
CREATE TABLE IF NOT EXISTS historico_chamados (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id      uuid        NOT NULL REFERENCES chamados(id) ON DELETE CASCADE,
  usuario_id      uuid        NOT NULL REFERENCES profiles(id),
  status_anterior text,
  status_novo     text        NOT NULL,
  observacao      text,
  data_mudanca    timestamptz DEFAULT now()
);

ALTER TABLE historico_chamados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "historico_select" ON historico_chamados
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "historico_insert" ON historico_chamados
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
