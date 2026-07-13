-- SYNC + CONVERSAS MANUAIS — corre UMA VEZ no Supabase SQL Editor

ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS suprimida BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS mensagens_json JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS fixada_em TIMESTAMPTZ;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS notas TEXT;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS adicionada_manual BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_conversas_manual ON public.conversas (user_id, adicionada_manual, suprimida);

-- Sync automático: SÓ artigos (inventário). Conversas são adicionadas manualmente.
CREATE OR REPLACE FUNCTION public.sync_from_vinted(
  p_sync_secret text,
  p_artigos jsonb DEFAULT '[]'::jsonb,
  p_conversas jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_artigos int := 0;
  a jsonb;
BEGIN
  SELECT id INTO v_user_id FROM public.profiles WHERE sync_secret = p_sync_secret;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sync secret inválido — copia de /setup no dashboard';
  END IF;

  FOR a IN SELECT value FROM jsonb_array_elements(COALESCE(p_artigos, '[]'::jsonb))
  LOOP
    INSERT INTO public.artigos_vinted (
      user_id, id_artigo, nome, marca, tamanho, preco_venda, status_artigo,
      foto_url, url_vinted, sincronizado_em, atualizado_em
    ) VALUES (
      v_user_id, a->>'id_artigo', COALESCE(a->>'nome', 'Sem nome'),
      NULLIF(a->>'marca', ''), NULLIF(a->>'tamanho', ''),
      COALESCE((a->>'preco_venda')::numeric, 0),
      CASE WHEN COALESCE(a->>'status_artigo', 'ativo') IN ('ativo','reservado','vendido','rascunho','oculto')
        THEN COALESCE(a->>'status_artigo', 'ativo')::status_artigo_vinted ELSE 'ativo'::status_artigo_vinted END,
      NULLIF(a->>'foto_url', ''), NULLIF(a->>'url_vinted', ''), now(), now()
    )
    ON CONFLICT (user_id, id_artigo) DO UPDATE SET
      nome = EXCLUDED.nome, marca = EXCLUDED.marca, tamanho = EXCLUDED.tamanho,
      preco_venda = EXCLUDED.preco_venda, status_artigo = EXCLUDED.status_artigo,
      foto_url = EXCLUDED.foto_url, url_vinted = EXCLUDED.url_vinted,
      sincronizado_em = now(), atualizado_em = now();
    v_artigos := v_artigos + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'artigos', v_artigos, 'conversas', 0);
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
BEGIN
  SELECT id INTO v_user_id FROM public.profiles WHERE sync_secret = p_sync_secret;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sync secret inválido — copia de /setup no dashboard';
  END IF;

  IF c IS NULL OR c->>'id_vinted' IS NULL THEN
    RAISE EXCEPTION 'Conversa inválida';
  END IF;

  INSERT INTO public.conversas (
    user_id, id_vinted, user_comprador, avatar_comprador, ultimo_texto,
    ultima_mensagem_de, status_inbox, status_negocio, valor_proposta,
    id_artigo_vinted, url_conversa, item_fechado,
    suprimida, adicionada_manual, mensagens_json, data_atualizacao
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
    false, true,
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
