ALTER TABLE public.conversas DROP CONSTRAINT IF EXISTS conversas_user_vinted_unique;
ALTER TABLE public.conversas ADD CONSTRAINT conversas_user_vinted_unique UNIQUE (user_id, id_vinted);
