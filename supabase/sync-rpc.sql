-- SYNC AUTOMÁTICO — corre UMA VEZ no Supabase SQL Editor
-- Permite à extensão sincronizar SEM Edge Functions

ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS suprimida BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS mensagens_json JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS iniciada_por TEXT;
ALTER TABLE public.conversas ADD COLUMN IF NOT EXISTS fixada_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_conversas_suprimida ON public.conversas (user_id, suprimida);
CREATE INDEX IF NOT EXISTS idx_conversas_fixada ON public.conversas (user_id, fixada_em DESC NULLS LAST);

UPDATE public.conversas
SET status_inbox = CASE
  WHEN COALESCE(iniciada_por, 'comprador') = 'vendedor' THEN 'proposta_enviada'::status_inbox
  ELSE 'proposta_recebida'::status_inbox
END
WHERE status_inbox = 'em_negociacao';

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
      v_user_id,
      a->>'id_artigo',
      COALESCE(a->>'nome', 'Sem nome'),
      NULLIF(a->>'marca', ''),
      NULLIF(a->>'tamanho', ''),
      COALESCE((a->>'preco_venda')::numeric, 0),
      CASE
        WHEN COALESCE(a->>'status_artigo', 'ativo') IN ('ativo','reservado','vendido','rascunho','oculto')
        THEN COALESCE(a->>'status_artigo', 'ativo')::status_artigo_vinted
        ELSE 'ativo'::status_artigo_vinted
      END,
      NULLIF(a->>'foto_url', ''),
      NULLIF(a->>'url_vinted', ''),
      now(),
      now()
    )
    ON CONFLICT (user_id, id_artigo) DO UPDATE SET
      nome = EXCLUDED.nome,
      marca = EXCLUDED.marca,
      tamanho = EXCLUDED.tamanho,
      preco_venda = EXCLUDED.preco_venda,
      status_artigo = EXCLUDED.status_artigo,
      foto_url = EXCLUDED.foto_url,
      url_vinted = EXCLUDED.url_vinted,
      sincronizado_em = now(),
      atualizado_em = now();
    v_artigos := v_artigos + 1;
  END LOOP;

  FOR c IN SELECT value FROM jsonb_array_elements(COALESCE(p_conversas, '[]'::jsonb))
  LOOP
    SELECT status_inbox, aberta_em, suprimida INTO v_existing
    FROM public.conversas
    WHERE user_id = v_user_id AND id_vinted = c->>'id_vinted';

    IF FOUND AND v_existing.suprimida THEN
      CONTINUE;
    END IF;

    v_unread := COALESCE((c->>'vinted_unread')::boolean, false);

    v_status := CASE
      WHEN COALESCE(c->>'status_inbox', 'por_responder') IN ('por_responder','proposta_recebida','proposta_enviada','em_negociacao','arquivada')
      THEN COALESCE(c->>'status_inbox', 'por_responder')::status_inbox
      ELSE 'por_responder'::status_inbox
    END;

    -- Unread da Vinted tem prioridade — nova mensagem reabre "por responder"
    IF v_unread AND NOT COALESCE((c->>'item_fechado')::boolean, false) THEN
      v_status := 'por_responder';
    END IF;

    IF v_status = 'em_negociacao' THEN
      v_status := CASE COALESCE(c->>'iniciada_por', 'comprador')
        WHEN 'vendedor' THEN 'proposta_enviada'::status_inbox
        ELSE 'proposta_recebida'::status_inbox
      END;
    END IF;

    IF v_existing.aberta_em IS NOT NULL AND v_status = 'por_responder' AND NOT v_unread THEN
      v_status := CASE COALESCE(c->>'iniciada_por', 'comprador')
        WHEN 'vendedor' THEN 'proposta_enviada'::status_inbox
        ELSE 'proposta_recebida'::status_inbox
      END;
    END IF;

    INSERT INTO public.conversas (
      user_id, id_vinted, user_comprador, avatar_comprador, ultimo_texto,
      ultima_mensagem_de, status_inbox, status_negocio, valor_proposta,
      id_artigo_vinted, url_conversa, item_fechado, suprimida, iniciada_por, mensagens_json, data_atualizacao
    ) VALUES (
      v_user_id,
      c->>'id_vinted',
      COALESCE(c->>'user_comprador', 'desconhecido'),
      NULLIF(c->>'avatar_comprador', ''),
      NULLIF(c->>'ultimo_texto', ''),
      CASE WHEN c->>'ultima_mensagem_de' = 'vendedor' THEN 'vendedor' ELSE 'comprador' END,
      v_status,
      CASE
        WHEN COALESCE(c->>'status_negocio', 'sem_proposta') IN ('sem_proposta','proposta_pendente','aceite','recusada','expirada')
        THEN COALESCE(c->>'status_negocio', 'sem_proposta')::status_negocio
        ELSE 'sem_proposta'::status_negocio
      END,
      NULLIF(c->>'valor_proposta', '')::numeric,
      NULLIF(c->>'id_artigo_vinted', ''),
      NULLIF(c->>'url_conversa', ''),
      COALESCE((c->>'item_fechado')::boolean, false),
      false,
      NULLIF(c->>'iniciada_por', ''),
      COALESCE(c->'mensagens', '[]'::jsonb),
      COALESCE((c->>'data_atualizacao')::timestamptz, now())
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
      mensagens_json = CASE
        WHEN jsonb_array_length(EXCLUDED.mensagens_json) > 0 THEN EXCLUDED.mensagens_json
        ELSE conversas.mensagens_json
      END,
      data_atualizacao = COALESCE(EXCLUDED.data_atualizacao, conversas.data_atualizacao)
    WHERE NOT conversas.suprimida;

    v_conversas := v_conversas + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'artigos', v_artigos, 'conversas', v_conversas);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_from_vinted(text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_from_vinted(text, jsonb, jsonb) TO anon, authenticated;
