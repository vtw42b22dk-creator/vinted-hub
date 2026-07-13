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

-- Sync automático: inventário (artigos à venda) + vendas concluídas.
DROP FUNCTION IF EXISTS public.sync_from_vinted(text, jsonb, jsonb);

CREATE OR REPLACE FUNCTION public.sync_from_vinted(
  p_sync_secret text,
  p_artigos jsonb DEFAULT '[]'::jsonb,
  p_vendas jsonb DEFAULT '[]'::jsonb
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

  RETURN jsonb_build_object('ok', true, 'artigos', v_artigos, 'vendas', v_vendas);
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

REVOKE ALL ON FUNCTION public.sync_from_vinted(text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_from_vinted(text, jsonb, jsonb) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.add_conversa_manual(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_conversa_manual(text, jsonb) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.get_pastas_ext(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_pastas_ext(text) TO anon, authenticated;
