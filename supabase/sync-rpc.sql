-- SYNC AUTOMÁTICO — corre UMA VEZ no Supabase SQL Editor
-- Permite à extensão sincronizar SEM Edge Functions

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
    INSERT INTO public.conversas (
      user_id, id_vinted, user_comprador, avatar_comprador, ultimo_texto,
      ultima_mensagem_de, status_inbox, status_negocio, valor_proposta,
      id_artigo_vinted, url_conversa, item_fechado, data_atualizacao
    ) VALUES (
      v_user_id,
      c->>'id_vinted',
      COALESCE(c->>'user_comprador', 'desconhecido'),
      NULLIF(c->>'avatar_comprador', ''),
      NULLIF(c->>'ultimo_texto', ''),
      CASE WHEN c->>'ultima_mensagem_de' = 'vendedor' THEN 'vendedor' ELSE 'comprador' END,
      CASE
        WHEN COALESCE(c->>'status_inbox', 'por_responder') IN ('por_responder','proposta_recebida','proposta_enviada','em_negociacao','arquivada')
        THEN COALESCE(c->>'status_inbox', 'por_responder')::status_inbox
        ELSE 'por_responder'::status_inbox
      END,
      CASE
        WHEN COALESCE(c->>'status_negocio', 'sem_proposta') IN ('sem_proposta','proposta_pendente','aceite','recusada','expirada')
        THEN COALESCE(c->>'status_negocio', 'sem_proposta')::status_negocio
        ELSE 'sem_proposta'::status_negocio
      END,
      NULLIF(c->>'valor_proposta', '')::numeric,
      NULLIF(c->>'id_artigo_vinted', ''),
      NULLIF(c->>'url_conversa', ''),
      COALESCE((c->>'item_fechado')::boolean, false),
      now()
    )
    ON CONFLICT (user_id, id_vinted) DO UPDATE SET
      user_comprador = EXCLUDED.user_comprador,
      avatar_comprador = EXCLUDED.avatar_comprador,
      ultimo_texto = EXCLUDED.ultimo_texto,
      ultima_mensagem_de = EXCLUDED.ultima_mensagem_de,
      status_inbox = EXCLUDED.status_inbox,
      status_negocio = EXCLUDED.status_negocio,
      valor_proposta = EXCLUDED.valor_proposta,
      id_artigo_vinted = EXCLUDED.id_artigo_vinted,
      url_conversa = EXCLUDED.url_conversa,
      item_fechado = EXCLUDED.item_fechado,
      data_atualizacao = now();
    v_conversas := v_conversas + 1;
  END LOOP;

  UPDATE public.conversas
  SET status_inbox = 'arquivada', item_fechado = true
  WHERE user_id = v_user_id
    AND id_artigo_vinted IN (
      SELECT id_artigo FROM public.artigos_vinted
      WHERE user_id = v_user_id AND status_artigo IN ('vendido', 'oculto')
    );

  RETURN jsonb_build_object('ok', true, 'artigos', v_artigos, 'conversas', v_conversas);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_from_vinted(text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_from_vinted(text, jsonb, jsonb) TO anon, authenticated;
