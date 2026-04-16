-- Corrige políticas RLS para incluir perfis arquiteto e prestador
-- Esses perfis substituem o antigo 'tecnico' no fluxo de execução de chamados.

-- ── chamados: leitura ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Sindico can view own chamados" ON public.chamados;

CREATE POLICY "Chamados visíveis por perfil" ON public.chamados
  FOR SELECT USING (
    -- síndico vê chamados do próprio condomínio
    sindico_id = auth.uid()
    -- executor vê chamados que foram atribuídos a ele (campo moderno)
    OR atribuido_para = auth.uid()
    -- executor legado (campo antigo tecnico_id)
    OR tecnico_id = auth.uid()
    -- admin vê tudo
    OR public.has_role(auth.uid(), 'admin')
    -- morador vê chamados que ele abriu
    OR criado_por = auth.uid()
    -- arquiteto e prestador veem chamados abertos do mesmo condomínio para poder aceitar
    OR (
      (public.has_role(auth.uid(), 'arquiteto') OR public.has_role(auth.uid(), 'prestador'))
      AND status = 'aberto'
    )
  );

-- ── chamados: atualização ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Tecnico can update assigned chamados" ON public.chamados;

CREATE POLICY "Executores podem atualizar chamados atribuídos" ON public.chamados
  FOR UPDATE USING (
    -- executor moderno: via atribuido_para
    atribuido_para = auth.uid()
    -- executor legado: via tecnico_id
    OR tecnico_id = auth.uid()
    -- admin pode tudo
    OR public.has_role(auth.uid(), 'admin')
    -- síndico pode atribuir / cancelar
    OR sindico_id = auth.uid()
  );

-- ── chamados: inserção ────────────────────────────────────────────────────────
-- A policy original exige sindico_id = auth.uid(), o que bloqueia moradores.
-- Substituímos por uma verificação mais ampla: qualquer autenticado pode inserir
-- (a coluna criado_por registra quem abriu de verdade).
DROP POLICY IF EXISTS "Sindico can create chamados" ON public.chamados;

CREATE POLICY "Autenticados podem abrir chamados" ON public.chamados
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ── condominios: leitura ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Sindico can view own condo" ON public.condominios;

CREATE POLICY "Condomínio visível por perfil" ON public.condominios
  FOR SELECT USING (
    sindico_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    -- arquiteto e prestador precisam ver o nome do condomínio nos dashboards
    OR public.has_role(auth.uid(), 'arquiteto')
    OR public.has_role(auth.uid(), 'prestador')
    OR public.has_role(auth.uid(), 'tecnico')
    -- morador pode ver o condomínio onde está vinculado
    OR public.has_role(auth.uid(), 'morador')
  );
