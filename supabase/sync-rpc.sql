-- SYNC + CONVERSAS MANUAIS — corre UMA VEZ no Supabase SQL Editor

ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS suprimida BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS mensagens_json JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS fixada_em TIMESTAMPTZ;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS notas TEXT;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS adicionada_manual BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_conversas_manual ON public.conversas (user_id, adicionada_manual, suprimida);

-- Pastas de conversas (criadas pelo utilizador no dashboard)
CREATE TABLE IF NOT EXISTS public.pastas_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pastas_conversas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pastas_select" ON public.pastas_conversas;
DROP POLICY IF EXISTS "pastas_insert" ON public.pastas_conversas;
DROP POLICY IF EXISTS "pastas_update" ON public.pastas_conversas;
DROP POLICY IF EXISTS "pastas_delete" ON public.pastas_conversas;
CREATE POLICY "pastas_select" ON public.pastas_conversas FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "pastas_insert" ON public.pastas_conversas FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "pastas_update" ON public.pastas_conversas FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "pastas_delete" ON public.pastas_conversas FOR DELETE USING (user_id = auth.uid());

ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS pasta_id UUID REFERENCES public.pastas_conversas(id) ON DELETE SET NULL;

-- Detalhe do artigo (para o modal do inventário)
ALTER TABLE public.artigos_vinted ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE public.artigos_vinted ADD COLUMN IF NOT EXISTS categoria TEXT;

-- Recriar a view para incluir as colunas novas
DROP VIEW IF EXISTS public.artigos_vinted_com_lucro;
CREATE VIEW public.artigos_vinted_com_lucro AS
SELECT
  *,
  (preco_venda - preco_custo) AS lucro_bruto,
  CASE
    WHEN preco_venda > 0 THEN ROUND(((preco_venda - preco_custo) / preco_venda) * 100, 1)
    ELSE 0
  END AS margem_percentual
FROM public.artigos_vinted;

-- Vendas concluídas (my_orders?order_type=sold)
CREATE TABLE IF NOT EXISTS public.vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id_venda TEXT NOT NULL,
  titulo TEXT NOT NULL DEFAULT 'Venda',
  preco NUMERIC(10, 2) NOT NULL DEFAULT 0,
  comprador TEXT,
  foto_url TEXT,
  url_venda TEXT,
  id_artigo TEXT,
  data_venda TIMESTAMPTZ NOT NULL DEFAULT now(),
  sincronizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vendas_user_venda_unique UNIQUE (user_id, id_venda)
);

ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vendas_own" ON public.vendas;
CREATE POLICY "vendas_own" ON public.vendas
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_vendas_user_data ON public.vendas (user_id, data_venda DESC);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.vendas;
EXCEPTION WHEN duplicate_object OR undefined_object THEN
  NULL;
END $$;

-- Investimento: artigos comprados (my_orders?order_type=purchased)
-- estado 'comprado' = em stock; 'vendido' = já revendido (preco_venda definido pelo utilizador)
CREATE TABLE IF NOT EXISTS public.investimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id_compra TEXT NOT NULL,
  titulo TEXT NOT NULL DEFAULT 'Compra',
  preco_compra NUMERIC(10, 2) NOT NULL DEFAULT 0,
  foto_url TEXT,
  url_compra TEXT,
  id_artigo TEXT,
  data_compra TIMESTAMPTZ NOT NULL DEFAULT now(),
  estado TEXT NOT NULL DEFAULT 'comprado' CHECK (estado IN ('comprado', 'vendido')),
  preco_venda NUMERIC(10, 2),
  data_venda TIMESTAMPTZ,
  notas TEXT,
  removida BOOLEAN NOT NULL DEFAULT false,
  sincronizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT investimento_user_compra_unique UNIQUE (user_id, id_compra)
);

ALTER TABLE public.investimento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "investimento_own" ON public.investimento;
CREATE POLICY "investimento_own" ON public.investimento
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_investimento_user ON public.investimento (user_id, estado, removida);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.investimento;
EXCEPTION WHEN duplicate_object OR undefined_object THEN
  NULL;
END $$;

-- Relevantes: anúncios que quero COMPRAR (marcados na Vinted pela extensão)
CREATE TABLE IF NOT EXISTS public.relevantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  id_item TEXT NOT NULL,
  titulo TEXT NOT NULL DEFAULT 'Artigo',
  preco NUMERIC(10, 2) NOT NULL DEFAULT 0,
  marca TEXT,
  tamanho TEXT,
  foto_url TEXT,
  url_item TEXT,
  vendedor TEXT,
  notas TEXT,
  sincronizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT relevantes_user_item_unique UNIQUE (user_id, id_item)
);

ALTER TABLE public.relevantes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "relevantes_own" ON public.relevantes;
CREATE POLICY "relevantes_own" ON public.relevantes
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_relevantes_user ON public.relevantes (user_id, criado_em DESC);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.relevantes;
EXCEPTION WHEN duplicate_object OR undefined_object THEN
  NULL;
END $$;

-- Limpar dados demo antigos (causavam artigos repetidos)
DELETE FROM public.conversas WHERE id_vinted IN ('conv-001','conv-002','conv-003','conv-004','conv-005');
DELETE FROM public.artigos_vinted WHERE id_artigo IN ('100001','100002','100003','100004','100005');
DELETE FROM public.artigos WHERE nome = 'Blusa vintage manual';

-- Realtime para a tabela de pastas (ignora se já estiver adicionada)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.pastas_conversas;
EXCEPTION WHEN duplicate_object OR undefined_object THEN
  NULL;
END $$;

-- Lista de pastas para a extensão (autenticada por sync secret)
CREATE OR REPLACE FUNCTION public.get_pastas_ext(p_sync_secret text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_pastas jsonb;
BEGIN
  SELECT id INTO v_user_id FROM public.profiles WHERE sync_secret = p_sync_secret;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sync secret inválido';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'nome', nome) ORDER BY nome), '[]'::jsonb)
  INTO v_pastas
  FROM public.pastas_conversas
  WHERE user_id = v_user_id;

  RETURN v_pastas;
END;
$$;

-- Sync automático: inventário + vendas + compras (investimento).
DROP FUNCTION IF EXISTS public.sync_from_vinted(text, jsonb, jsonb);
DROP FUNCTION IF EXISTS public.sync_from_vinted(text, jsonb, jsonb, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.sync_from_vinted(
  p_sync_secret text,
  p_artigos jsonb DEFAULT '[]'::jsonb,
  p_vendas jsonb DEFAULT '[]'::jsonb,
  p_compras jsonb DEFAULT '[]'::jsonb,
  p_synced_ids jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_artigos int := 0;
  v_vendas int := 0;
  v_compras int := 0;
  a jsonb;
  s jsonb;
BEGIN
  SELECT id INTO v_user_id FROM public.profiles WHERE sync_secret = p_sync_secret;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sync secret inválido — abre o dashboard com login';
  END IF;

  FOR a IN SELECT value FROM jsonb_array_elements(COALESCE(p_artigos, '[]'::jsonb))
  LOOP
    INSERT INTO public.artigos_vinted (
      user_id, id_artigo, nome, marca, tamanho, preco_venda, status_artigo,
      foto_url, url_vinted, descricao, categoria, sincronizado_em, atualizado_em
    ) VALUES (
      v_user_id, a->>'id_artigo', COALESCE(a->>'nome', 'Sem nome'),
      NULLIF(a->>'marca', ''), NULLIF(a->>'tamanho', ''),
      COALESCE((a->>'preco_venda')::numeric, 0),
      CASE WHEN COALESCE(a->>'status_artigo', 'ativo') IN ('ativo','reservado','vendido','rascunho','oculto')
        THEN COALESCE(a->>'status_artigo', 'ativo')::status_artigo_vinted ELSE 'ativo'::status_artigo_vinted END,
      NULLIF(a->>'foto_url', ''), NULLIF(a->>'url_vinted', ''),
      NULLIF(a->>'descricao', ''), NULLIF(a->>'categoria', ''), now(), now()
    )
    ON CONFLICT (user_id, id_artigo) DO UPDATE SET
      nome = EXCLUDED.nome, marca = EXCLUDED.marca, tamanho = EXCLUDED.tamanho,
      preco_venda = EXCLUDED.preco_venda, status_artigo = EXCLUDED.status_artigo,
      foto_url = EXCLUDED.foto_url, url_vinted = EXCLUDED.url_vinted,
      descricao = COALESCE(EXCLUDED.descricao, artigos_vinted.descricao),
      categoria = COALESCE(EXCLUDED.categoria, artigos_vinted.categoria),
      sincronizado_em = now(), atualizado_em = now();
    v_artigos := v_artigos + 1;
  END LOOP;

  -- Reconciliação: artigos que já não voltam da Vinted (vendidos/removidos)
  -- saem do inventário. Só corre se recebermos a lista completa sincronizada.
  IF jsonb_array_length(COALESCE(p_synced_ids, '[]'::jsonb)) > 0 THEN
    UPDATE public.artigos_vinted
    SET status_artigo = 'vendido', atualizado_em = now()
    WHERE user_id = v_user_id
      AND status_artigo IN ('ativo', 'reservado')
      AND id_artigo NOT IN (SELECT jsonb_array_elements_text(p_synced_ids));
  END IF;

  FOR s IN SELECT value FROM jsonb_array_elements(COALESCE(p_vendas, '[]'::jsonb))
  LOOP
    CONTINUE WHEN s->>'id_venda' IS NULL;
    INSERT INTO public.vendas (
      user_id, id_venda, titulo, preco, comprador, foto_url, url_venda, id_artigo, data_venda
    ) VALUES (
      v_user_id, s->>'id_venda', COALESCE(NULLIF(s->>'titulo', ''), 'Venda'),
      COALESCE((s->>'preco')::numeric, 0), NULLIF(s->>'comprador', ''),
      NULLIF(s->>'foto_url', ''), NULLIF(s->>'url_venda', ''),
      NULLIF(s->>'id_artigo', ''), COALESCE((s->>'data_venda')::timestamptz, now())
    )
    ON CONFLICT (user_id, id_venda) DO UPDATE SET
      titulo = EXCLUDED.titulo, preco = EXCLUDED.preco, comprador = EXCLUDED.comprador,
      foto_url = EXCLUDED.foto_url, url_venda = EXCLUDED.url_venda,
      id_artigo = EXCLUDED.id_artigo, data_venda = EXCLUDED.data_venda,
      sincronizado_em = now();
    v_vendas := v_vendas + 1;
  END LOOP;

  -- Compras (investimento). Preserva estado/preco_venda/data_venda/removida definidos pelo utilizador.
  FOR s IN SELECT value FROM jsonb_array_elements(COALESCE(p_compras, '[]'::jsonb))
  LOOP
    CONTINUE WHEN s->>'id_compra' IS NULL;
    INSERT INTO public.investimento (
      user_id, id_compra, titulo, preco_compra, foto_url, url_compra, id_artigo, data_compra
    ) VALUES (
      v_user_id, s->>'id_compra', COALESCE(NULLIF(s->>'titulo', ''), 'Compra'),
      COALESCE((s->>'preco_compra')::numeric, 0), NULLIF(s->>'foto_url', ''),
      NULLIF(s->>'url_compra', ''), NULLIF(s->>'id_artigo', ''),
      COALESCE((s->>'data_compra')::timestamptz, now())
    )
    ON CONFLICT (user_id, id_compra) DO UPDATE SET
      titulo = EXCLUDED.titulo,
      preco_compra = EXCLUDED.preco_compra,
      foto_url = EXCLUDED.foto_url,
      url_compra = EXCLUDED.url_compra,
      id_artigo = EXCLUDED.id_artigo,
      data_compra = EXCLUDED.data_compra,
      sincronizado_em = now();
    v_compras := v_compras + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'artigos', v_artigos, 'vendas', v_vendas, 'compras', v_compras);
END;
$$;

-- Adicionar (ou atualizar) UMA conversa manualmente a partir do botão na Vinted.
-- Preserva notas e fixada_em; reativa se estava removida.
CREATE OR REPLACE FUNCTION public.add_conversa_manual(
  p_sync_secret text,
  p_conversa jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  c jsonb := p_conversa;
  v_pasta uuid;
BEGIN
  SELECT id INTO v_user_id FROM public.profiles WHERE sync_secret = p_sync_secret;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sync secret inválido — abre o dashboard para ligar a extensão';
  END IF;

  IF c IS NULL OR c->>'id_vinted' IS NULL THEN
    RAISE EXCEPTION 'Conversa inválida';
  END IF;

  -- Pasta escolhida no botão da Vinted (tem de pertencer ao utilizador)
  BEGIN
    v_pasta := NULLIF(c->>'pasta_id', '')::uuid;
  EXCEPTION WHEN others THEN
    v_pasta := NULL;
  END;
  IF v_pasta IS NOT NULL THEN
    SELECT id INTO v_pasta FROM public.pastas_conversas
    WHERE id = v_pasta AND user_id = v_user_id;
  END IF;

  INSERT INTO public.conversas (
    user_id, id_vinted, user_comprador, avatar_comprador, ultimo_texto,
    ultima_mensagem_de, status_inbox, status_negocio, valor_proposta,
    id_artigo_vinted, url_conversa, item_fechado,
    suprimida, adicionada_manual, pasta_id, mensagens_json, data_atualizacao
  ) VALUES (
    v_user_id, c->>'id_vinted', COALESCE(c->>'user_comprador', 'desconhecido'),
    NULLIF(c->>'avatar_comprador', ''), NULLIF(c->>'ultimo_texto', ''),
    CASE WHEN c->>'ultima_mensagem_de' = 'vendedor' THEN 'vendedor' ELSE 'comprador' END,
    'proposta_recebida'::status_inbox,
    CASE WHEN COALESCE(c->>'status_negocio', 'sem_proposta') IN ('sem_proposta','proposta_pendente','aceite','recusada','expirada')
      THEN COALESCE(c->>'status_negocio', 'sem_proposta')::status_negocio ELSE 'sem_proposta'::status_negocio END,
    NULLIF(c->>'valor_proposta', '')::numeric,
    NULLIF(c->>'id_artigo_vinted', ''), NULLIF(c->>'url_conversa', ''),
    COALESCE((c->>'item_fechado')::boolean, false),
    false, true, v_pasta,
    COALESCE(c->'mensagens', '[]'::jsonb),
    COALESCE((c->>'data_atualizacao')::timestamptz, now())
  )
  ON CONFLICT (user_id, id_vinted) DO UPDATE SET
    user_comprador = EXCLUDED.user_comprador,
    avatar_comprador = EXCLUDED.avatar_comprador,
    ultimo_texto = EXCLUDED.ultimo_texto,
    ultima_mensagem_de = EXCLUDED.ultima_mensagem_de,
    status_negocio = EXCLUDED.status_negocio,
    valor_proposta = EXCLUDED.valor_proposta,
    id_artigo_vinted = EXCLUDED.id_artigo_vinted,
    url_conversa = EXCLUDED.url_conversa,
    item_fechado = EXCLUDED.item_fechado,
    suprimida = false,
    adicionada_manual = true,
    pasta_id = COALESCE(v_pasta, conversas.pasta_id),
    mensagens_json = CASE
      WHEN jsonb_array_length(EXCLUDED.mensagens_json) > 0 THEN EXCLUDED.mensagens_json
      ELSE conversas.mensagens_json
    END,
    data_atualizacao = EXCLUDED.data_atualizacao;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Adicionar UM anúncio aos "relevantes" (a comprar) a partir do botão na Vinted.
CREATE OR REPLACE FUNCTION public.add_relevante(
  p_sync_secret text,
  p_item jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  i jsonb := p_item;
BEGIN
  SELECT id INTO v_user_id FROM public.profiles WHERE sync_secret = p_sync_secret;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sync secret inválido — abre o dashboard para ligar a extensão';
  END IF;

  IF i IS NULL OR i->>'id_item' IS NULL THEN
    RAISE EXCEPTION 'Artigo inválido';
  END IF;

  INSERT INTO public.relevantes (
    user_id, id_item, titulo, preco, marca, tamanho, foto_url, url_item, vendedor
  ) VALUES (
    v_user_id, i->>'id_item', COALESCE(NULLIF(i->>'titulo', ''), 'Artigo'),
    COALESCE((i->>'preco')::numeric, 0), NULLIF(i->>'marca', ''),
    NULLIF(i->>'tamanho', ''), NULLIF(i->>'foto_url', ''),
    NULLIF(i->>'url_item', ''), NULLIF(i->>'vendedor', '')
  )
  ON CONFLICT (user_id, id_item) DO UPDATE SET
    titulo = EXCLUDED.titulo,
    preco = EXCLUDED.preco,
    marca = EXCLUDED.marca,
    tamanho = EXCLUDED.tamanho,
    foto_url = EXCLUDED.foto_url,
    url_item = EXCLUDED.url_item,
    vendedor = EXCLUDED.vendedor,
    sincronizado_em = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_from_vinted(text, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_from_vinted(text, jsonb, jsonb, jsonb, jsonb) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.add_conversa_manual(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_conversa_manual(text, jsonb) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.add_relevante(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_relevante(text, jsonb) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.get_pastas_ext(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pastas_ext(text) TO anon, authenticated;
