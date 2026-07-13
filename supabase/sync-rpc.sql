-- SYNC AUTOMÁTICO — corre UMA VEZ no Supabase SQL Editor

ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS suprimida BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS mensagens_json JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS iniciada_por TEXT;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS fixada_em TIMESTAMPTZ;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS vista_em TIMESTAMPTZ;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS oculta_por_responder BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS precisa_responder BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS vinted_unread BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS eh_proposta BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_conversas_suprimida ON public.conversas (user_id, suprimida);
CREATE INDEX IF NOT EXISTS idx_conversas_por_responder ON public.conversas (user_id, precisa_responder, oculta_por_responder);
CREATE INDEX IF NOT EXISTS idx_conversas_iniciada ON public.conversas (user_id, iniciada_por, eh_proposta);

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
  v_conversas int := 0;
  a jsonb;
  c jsonb;
  v_existing record;
  v_status status_inbox;
  v_unread boolean;
  v_precisa boolean;
  v_oculta boolean;
  v_vista timestamptz;
  v_nova_atividade timestamptz;
  v_iniciada text;
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

  FOR c IN SELECT value FROM jsonb_array_elements(COALESCE(p_conversas, '[]'::jsonb))
  LOOP
    SELECT status_inbox, aberta_em, suprimida, vista_em, oculta_por_responder
    INTO v_existing
    FROM public.conversas
    WHERE user_id = v_user_id AND id_vinted = c->>'id_vinted';

    IF FOUND AND v_existing.suprimida THEN
      CONTINUE;
    END IF;

    v_unread := COALESCE((c->>'vinted_unread')::boolean, false);
    v_precisa := COALESCE((c->>'precisa_responder')::boolean, false);
    v_iniciada := NULLIF(c->>'iniciada_por', '');
    v_nova_atividade := COALESCE((c->>'data_atualizacao')::timestamptz, now());
    v_vista := v_existing.vista_em;
    v_oculta := COALESCE(v_existing.oculta_por_responder, false);

    -- Marcada como vista / eliminada do por responder: só volta se actividade nova
    IF v_oculta THEN
      IF v_vista IS NOT NULL AND v_nova_atividade > v_vista AND v_precisa THEN
        v_oculta := false;
      ELSE
        v_precisa := false;
        v_unread := false;
      END IF;
    END IF;

    v_status := COALESCE(c->>'status_inbox', 'proposta_recebida')::status_inbox;

    IF COALESCE((c->>'item_fechado')::boolean, false) THEN
      v_status := 'arquivada';
      v_precisa := false;
    ELSIF v_precisa THEN
      v_status := 'por_responder';
    ELSIF v_iniciada = 'vendedor' THEN
      v_status := 'proposta_enviada';
    ELSE
      v_status := 'proposta_recebida';
    END IF;

    INSERT INTO public.conversas (
      user_id, id_vinted, user_comprador, avatar_comprador, ultimo_texto,
      ultima_mensagem_de, status_inbox, status_negocio, valor_proposta,
      id_artigo_vinted, url_conversa, item_fechado, suprimida, iniciada_por,
      precisa_responder, vinted_unread, eh_proposta, oculta_por_responder,
      mensagens_json, data_atualizacao
    ) VALUES (
      v_user_id, c->>'id_vinted', COALESCE(c->>'user_comprador', 'desconhecido'),
      NULLIF(c->>'avatar_comprador', ''), NULLIF(c->>'ultimo_texto', ''),
      CASE WHEN c->>'ultima_mensagem_de' = 'vendedor' THEN 'vendedor' ELSE 'comprador' END,
      v_status,
      CASE WHEN COALESCE(c->>'status_negocio', 'sem_proposta') IN ('sem_proposta','proposta_pendente','aceite','recusada','expirada')
        THEN COALESCE(c->>'status_negocio', 'sem_proposta')::status_negocio ELSE 'sem_proposta'::status_negocio END,
      NULLIF(c->>'valor_proposta', '')::numeric,
      NULLIF(c->>'id_artigo_vinted', ''), NULLIF(c->>'url_conversa', ''),
      COALESCE((c->>'item_fechado')::boolean, false), false,
      v_iniciada,
      v_precisa, v_unread, COALESCE((c->>'eh_proposta')::boolean, false), v_oculta,
      COALESCE(c->'mensagens', '[]'::jsonb), v_nova_atividade
    )
    ON CONFLICT (user_id, id_vinted) DO UPDATE SET
      user_comprador = EXCLUDED.user_comprador,
      avatar_comprador = EXCLUDED.avatar_comprador,
      ultimo_texto = EXCLUDED.ultimo_texto,
      ultima_mensagem_de = EXCLUDED.ultima_mensagem_de,
      status_inbox = CASE WHEN conversas.suprimida THEN conversas.status_inbox ELSE EXCLUDED.status_inbox END,
      status_negocio = EXCLUDED.status_negocio,
      valor_proposta = EXCLUDED.valor_proposta,
      id_artigo_vinted = EXCLUDED.id_artigo_vinted,
      url_conversa = EXCLUDED.url_conversa,
      item_fechado = EXCLUDED.item_fechado,
      iniciada_por = COALESCE(EXCLUDED.iniciada_por, conversas.iniciada_por),
      precisa_responder = EXCLUDED.precisa_responder,
      vinted_unread = EXCLUDED.vinted_unread,
      eh_proposta = EXCLUDED.eh_proposta,
      oculta_por_responder = EXCLUDED.oculta_por_responder,
      mensagens_json = CASE
        WHEN jsonb_array_length(EXCLUDED.mensagens_json) > 0 THEN EXCLUDED.mensagens_json
        ELSE conversas.mensagens_json
      END,
      data_atualizacao = EXCLUDED.data_atualizacao
    WHERE NOT conversas.suprimida;

    v_conversas := v_conversas + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'artigos', v_artigos, 'conversas', v_conversas);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_from_vinted(text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_from_vinted(text, jsonb, jsonb) TO anon, authenticated;
