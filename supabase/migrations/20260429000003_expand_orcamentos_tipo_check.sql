-- Expand orcamentos tipo CHECK constraint to include additional service types
ALTER TABLE orcamentos DROP CONSTRAINT IF EXISTS orcamentos_tipo_check;

ALTER TABLE orcamentos ADD CONSTRAINT orcamentos_tipo_check
  CHECK (tipo IN ('reparo','arquitetura','limpeza','seguranca','pintura','eletrica','hidraulica','jardinagem','outro'));
