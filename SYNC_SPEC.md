# SYNC_SPEC.md — Fino Haus
> Arquivo de especificação de arquitetura. Gerado a partir da versão Base44.
> Use este arquivo para sincronizar o projeto com a arquitetura definida.
> Comando: `claude "leia o SYNC_SPEC.md e aplique todas as instruções"`

---

## 1. CONTEXTO DO PROJETO

**Nome:** Fino Haus  
**Tipo:** SaaS de gestão condominial  
**Stack:** React + TypeScript + Vite + Supabase + Tailwind CSS  
**Deploy:** Vercel (via GitHub)  
**Fluxo de desenvolvimento:** Claude Code → GitHub → Vercel

---

## 2. PERFIS DE USUÁRIO

O sistema possui 5 perfis. O campo `perfil` na tabela `usuarios` deve ser um enum com exatamente estes valores:

| Perfil | Descrição |
|--------|-----------|
| `admin` | Acesso total ao sistema, todos os condomínios |
| `sindico` | Gestão do condomínio vinculado: chamados, atribuições, moradores |
| `morador` | Abre chamados, acompanha status, vinculado a uma unidade |
| `arquiteto` | Recebe chamados atribuídos, atualiza status e observações |
| `prestador` | Mesmo acesso do arquiteto, perfil para prestadores externos |

> ⚠️ O valor `zelador` foi removido e substituído por `arquiteto` em toda a base.

---

## 3. MODELAGEM DO BANCO DE DADOS

### 3.1 Tabela: `condominios`

| Campo | Tipo | Regras |
|-------|------|--------|
| `id` | uuid | primary key, gerado automaticamente |
| `nome` | text | obrigatório |
| `endereco` | text | opcional |
| `cidade` | text | opcional |
| `cnpj` | text | opcional |
| `ativo` | boolean | padrão: true |

---

### 3.2 Tabela: `unidades`

| Campo | Tipo | Regras |
|-------|------|--------|
| `id` | uuid | primary key |
| `numero` | text | obrigatório — ex: "101", "B-204" |
| `bloco` | text | opcional — ex: "A", "Torre 1" |
| `tipo` | enum | apartamento / casa / loja / vaga |
| `condominio_id` | uuid | FK → condominios.id |

---

### 3.3 Tabela: `usuarios`

| Campo | Tipo | Regras |
|-------|------|--------|
| `id` | uuid | primary key |
| `nome` | text | obrigatório |
| `email` | text | obrigatório, único |
| `perfil` | enum | admin / sindico / morador / arquiteto / prestador |
| `condominio_id` | uuid | FK → condominios.id |
| `unidade_id` | uuid | FK → unidades.id — opcional, apenas moradores |
| `ativo` | boolean | padrão: true |

---

### 3.4 Tabela: `chamados`

| Campo | Tipo | Regras |
|-------|------|--------|
| `id` | uuid | primary key |
| `titulo` | text | obrigatório |
| `descricao` | text | opcional |
| `tipo` | enum | reparo / arquitetura / limpeza / seguranca / outro |
| `status` | enum | aberto / atribuido / em_andamento / concluido / cancelado — padrão: aberto |
| `prioridade` | enum | baixa / media / alta — padrão: media |
| `unidade_id` | uuid | FK → unidades.id |
| `criado_por` | uuid | FK → usuarios.id |
| `atribuido_para` | uuid | FK → usuarios.id — opcional |
| `condominio_id` | uuid | FK → condominios.id |
| `data_abertura` | timestamptz | padrão: now() |
| `data_conclusao` | timestamptz | opcional |
| `foto_url` | text | opcional |

> ⚠️ O valor `zeladoria` foi removido do enum de tipo e substituído por `arquitetura`.

---

### 3.5 Tabela: `historico_chamados` ← NOVA TABELA

| Campo | Tipo | Regras |
|-------|------|--------|
| `id` | uuid | primary key |
| `chamado_id` | uuid | FK → chamados.id, obrigatório |
| `usuario_id` | uuid | FK → usuarios.id, obrigatório |
| `status_anterior` | text | pode ser vazio (chamado novo) |
| `status_novo` | text | obrigatório |
| `observacao` | text | opcional |
| `data_mudanca` | timestamptz | padrão: now() |

Habilitar RLS com política de leitura para usuários autenticados do mesmo condomínio.

---

## 4. MIGRAÇÕES NECESSÁRIAS

Execute as migrações abaixo no Supabase em ordem:

### 4.1 Atualizar enum de perfil
```sql
-- Adicionar novo valor
ALTER TYPE perfil_enum ADD VALUE IF NOT EXISTS 'arquiteto';

-- Migrar registros existentes
UPDATE usuarios SET perfil = 'arquiteto' WHERE perfil = 'zelador';

-- Remover valor antigo (requer recriação do tipo se necessário)
```

### 4.2 Atualizar enum de tipo do chamado
```sql
ALTER TYPE tipo_chamado_enum ADD VALUE IF NOT EXISTS 'arquitetura';
UPDATE chamados SET tipo = 'arquitetura' WHERE tipo = 'zeladoria';
```

### 4.3 Adicionar campo prioridade
```sql
ALTER TABLE chamados
ADD COLUMN IF NOT EXISTS prioridade text NOT NULL DEFAULT 'media'
CHECK (prioridade IN ('baixa', 'media', 'alta'));
```

### 4.4 Criar tabela historico_chamados
```sql
CREATE TABLE IF NOT EXISTS historico_chamados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chamado_id uuid NOT NULL REFERENCES chamados(id),
  usuario_id uuid NOT NULL REFERENCES usuarios(id),
  status_anterior text,
  status_novo text NOT NULL,
  observacao text,
  data_mudanca timestamptz DEFAULT now()
);

ALTER TABLE historico_chamados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura por condominio" ON historico_chamados
FOR SELECT USING (
  chamado_id IN (
    SELECT id FROM chamados WHERE condominio_id = (
      SELECT condominio_id FROM usuarios WHERE id = auth.uid()
    )
  )
);
```

---

## 5. LÓGICA DE NEGÓCIO

### 5.1 Abertura de chamado (morador)

Ao criar um chamado:
1. Inserir registro em `chamados` com status = `aberto`, prioridade = valor selecionado
2. Inserir em `historico_chamados`:
   - `status_anterior` = "" (vazio)
   - `status_novo` = "aberto"
   - `observacao` = "Chamado aberto pelo morador"

### 5.2 Atribuição de chamado (síndico)

Ao atribuir um chamado:
1. Atualizar `chamados.atribuido_para` = usuario selecionado
2. Atualizar `chamados.status` = "atribuido"
3. Inserir em `historico_chamados`:
   - `status_anterior` = "aberto"
   - `status_novo` = "atribuido"
   - `observacao` = "Chamado atribuído pelo síndico"

### 5.3 Atualização de status (arquiteto / prestador)

Ao atualizar status:
1. Atualizar `chamados.status` = novo status
2. Se novo status = "concluido": salvar `chamados.data_conclusao` = now()
3. Inserir em `historico_chamados`:
   - `status_anterior` = status anterior
   - `status_novo` = novo status selecionado
   - `observacao` = texto preenchido pelo arquiteto/prestador

---

## 6. PÁGINAS E COMPONENTES

### 6.1 Tela de abertura de chamado (morador)

**Campos do formulário:**
- Título (text, obrigatório)
- Tipo (dropdown: reparo / arquitetura / limpeza / seguranca / outro)
- Local (text, obrigatório) — concatenar na descrição ao salvar
- Descrição (textarea, mínimo 10 caracteres)
- Foto (upload, opcional — jpg/jpeg/png → salvar em foto_url)
- Prioridade (seletor: baixa / media / alta — padrão: media)

**Abaixo do formulário:** lista "Meus chamados" filtrada por `criado_por = usuario logado`, ordenada por `data_abertura` decrescente.

---

### 6.2 Dashboard do síndico

**Cards de resumo:** total / abertos / em andamento / concluídos

**Lista de chamados:** filtrada por `condominio_id = condominio do usuario logado`

**Colunas:** Unidade, Título, Tipo, Status (badge), Prioridade (badge), Data abertura, Atribuído para, Botão "Atribuir"

**Filtros:** status / tipo / prioridade

**Badges de status:**
- aberto = amarelo
- atribuido = azul
- em_andamento = laranja
- concluido = verde
- cancelado = cinza

**Badges de prioridade:**
- baixa = cinza
- media = amarelo
- alta = vermelho

**Ação "Atribuir":** dropdown com usuarios onde `perfil IN ('arquiteto', 'prestador')` e `condominio_id = condominio do chamado`. Ao confirmar, executa lógica 5.2.

---

### 6.3 Dashboard do arquiteto / prestador

**Cards de resumo:** atribuídos / em andamento / concluídos

**Lista de chamados:** filtrada por `atribuido_para = usuario logado`

**Colunas:** Unidade, Título, Tipo, Status (badge), Prioridade (badge), Data abertura, Botão "Ver detalhes", Botão "Atualizar status"

**Ordenação:** prioridade alta → media → baixa; dentro de cada prioridade, `data_abertura` crescente (mais antigo primeiro)

**Botão "Atualizar status":** disponível apenas para status `atribuido` ou `em_andamento`. Abre modal com:
- Novo status (dropdown: em_andamento / concluido)
- Observação (textarea, obrigatório)
- Upload de foto (opcional)

Ao confirmar, executa lógica 5.3.

---

## 7. SUBSTITUIÇÕES GLOBAIS DE TEXTO

Verificar e substituir em todos os arquivos do projeto:

| De | Para | Contexto |
|----|------|---------|
| `zelador` | `arquiteto` | enums, types, labels, rotas, variáveis |
| `zeladoria` | `arquitetura` | enums, types, labels, dropdowns |
| `Zelador` | `Arquiteto` | labels visíveis na UI |
| `Zeladoria` | `Arquitetura` | labels visíveis na UI |

---

## 8. VALIDAÇÃO FINAL

Após aplicar todas as instruções, confirmar:

- [ ] Nenhuma ocorrência de "zelador" ou "zeladoria" no código ou banco
- [ ] Tabela `historico_chamados` criada com todos os campos
- [ ] Campo `prioridade` existe na tabela `chamados`
- [ ] Toda criação/atualização de chamado grava em `historico_chamados`
- [ ] Dashboard do arquiteto ordena por prioridade antes de data
- [ ] Filtro de prioridade presente no dashboard do síndico
- [ ] Listar todos os arquivos modificados ao final
