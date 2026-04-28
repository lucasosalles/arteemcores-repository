-- Beta 1.0 — Estrutura Completa (Parte 1)
-- Tabelas: orcamentos, disponibilidade_prestador, notificacoes, pagamentos_simulados
-- RLS habilitado em todas as tabelas

-- ══════════════════════════════════════════════════════════════
-- 1.1 Tabela orcamentos
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS orcamentos (
  id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo            text          NOT NULL,
  descricao         text,
  tipo              text          NOT NULL
                                  CHECK (tipo IN ('reparo','arquitetura','limpeza','seguranca','outro')),
  status            text          NOT NULL DEFAULT 'rascunho'
                                  CHECK (status IN (
                                    'rascunho','enviado','em_analise','aprovado',
                                    'recusado','em_execucao','concluido','cancelado'
                                  )),
  solicitante_id    uuid          NOT NULL REFERENCES profiles(id),
  prestador_id      uuid          REFERENCES profiles(id),
  condominio_id     uuid          REFERENCES condominios(id),
  unidade_id        uuid          REFERENCES unidades(id),
  chamado_id        uuid          REFERENCES chamados(id),
  valor_proposto    numeric(10,2),
  valor_aprovado    numeric(10,2),
  prazo_dias        integer,
  dentro_do_plano   boolean       NOT NULL DEFAULT false,
  data_solicitacao  timestamptz   DEFAULT now(),
  data_aprovacao    timestamptz,
  data_conclusao    timestamptz,
  observacoes       text,
  foto_url          text
);

ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════
-- 1.2 Tabela disponibilidade_prestador
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS disponibilidade_prestador (
  id                        uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  prestador_id              uuid      NOT NULL REFERENCES profiles(id),
  disponivel                boolean   NOT NULL DEFAULT true,
  proxima_disponibilidade   date,
  especialidades            text[],
  tempo_medio_execucao_dias integer,
  observacao                text,
  updated_at                timestamptz DEFAULT now()
);

ALTER TABLE disponibilidade_prestador ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════
-- 1.3 Tabela notificacoes
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notificacoes (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id  uuid    NOT NULL REFERENCES profiles(id),
  titulo      text    NOT NULL,
  mensagem    text    NOT NULL,
  tipo        text    NOT NULL CHECK (tipo IN ('chamado','orcamento','pagamento','sistema')),
  lida        boolean NOT NULL DEFAULT false,
  link        text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════
-- 1.4 Tabela pagamentos_simulados
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pagamentos_simulados (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id    uuid          REFERENCES orcamentos(id),
  chamado_id      uuid          REFERENCES chamados(id),
  condominio_id   uuid          REFERENCES condominios(id),
  solicitante_id  uuid          NOT NULL REFERENCES profiles(id),
  prestador_id    uuid          REFERENCES profiles(id),
  valor           numeric(10,2) NOT NULL,
  descricao       text,
  status          text          NOT NULL DEFAULT 'pendente'
                                CHECK (status IN ('pendente','pago','atrasado','cancelado')),
  forma_pagamento text          CHECK (forma_pagamento IN ('boleto','pix','cartao','fatura_mensal')),
  data_vencimento date,
  data_pagamento  date,
  created_at      timestamptz   DEFAULT now()
);

ALTER TABLE pagamentos_simulados ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════
-- 1.5 Habilitar Realtime (seguro contra duplicatas)
-- ══════════════════════════════════════════════════════════════

DO $$
DECLARE
  tabelas text[] := ARRAY['chamados','orcamentos','notificacoes','historico_chamados'];
  t text;
BEGIN
  FOREACH t IN ARRAY tabelas LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    END IF;
  END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════
-- 1.6 RLS Policies — orcamentos
-- ══════════════════════════════════════════════════════════════

CREATE POLICY "orcamentos_select_partes" ON orcamentos
  FOR SELECT USING (
    auth.uid() = solicitante_id
    OR auth.uid() = prestador_id
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role IN ('admin','sindico')
    )
  );

CREATE POLICY "orcamentos_insert_solicitante" ON orcamentos
  FOR INSERT WITH CHECK (auth.uid() = solicitante_id);

CREATE POLICY "orcamentos_update_partes" ON orcamentos
  FOR UPDATE USING (
    auth.uid() = solicitante_id
    OR auth.uid() = prestador_id
    OR EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "orcamentos_delete_admin" ON orcamentos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ══════════════════════════════════════════════════════════════
-- 1.7 RLS Policies — disponibilidade_prestador
-- ══════════════════════════════════════════════════════════════

CREATE POLICY "disponibilidade_select_all" ON disponibilidade_prestador
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "disponibilidade_insert_prestador" ON disponibilidade_prestador
  FOR INSERT WITH CHECK (auth.uid() = prestador_id);

CREATE POLICY "disponibilidade_update_prestador" ON disponibilidade_prestador
  FOR UPDATE USING (auth.uid() = prestador_id);

CREATE POLICY "disponibilidade_delete_prestador" ON disponibilidade_prestador
  FOR DELETE USING (auth.uid() = prestador_id);

-- ══════════════════════════════════════════════════════════════
-- 1.8 RLS Policies — notificacoes
-- ══════════════════════════════════════════════════════════════

CREATE POLICY "notificacoes_select_own" ON notificacoes
  FOR SELECT USING (auth.uid() = usuario_id);

-- Permite inserção por qualquer autenticado (notificações criadas via frontend/trigger)
CREATE POLICY "notificacoes_insert" ON notificacoes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "notificacoes_update_own" ON notificacoes
  FOR UPDATE USING (auth.uid() = usuario_id);

-- ══════════════════════════════════════════════════════════════
-- 1.9 RLS Policies — pagamentos_simulados
-- ══════════════════════════════════════════════════════════════

CREATE POLICY "pagamentos_admin_all" ON pagamentos_simulados
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "pagamentos_sindico_select" ON pagamentos_simulados
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN condominios c ON c.sindico_id = auth.uid()
      WHERE ur.user_id = auth.uid() AND ur.role = 'sindico'
        AND c.id = pagamentos_simulados.condominio_id
    )
  );

CREATE POLICY "pagamentos_solicitante_select" ON pagamentos_simulados
  FOR SELECT USING (auth.uid() = solicitante_id);

CREATE POLICY "pagamentos_prestador_select" ON pagamentos_simulados
  FOR SELECT USING (auth.uid() = prestador_id);
