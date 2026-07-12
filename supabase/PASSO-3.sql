-- PASSO 3 de 3 — Copia isto, cola no Supabase, clica RUN
-- Pronto! Cria conta no dashboard e vai a /setup

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artigos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artigos_vinted ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dev: acesso total artigos_vinted" ON public.artigos_vinted;
DROP POLICY IF EXISTS "Dev: acesso total conversas" ON public.conversas;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "artigos_own" ON public.artigos;
DROP POLICY IF EXISTS "artigos_vinted_own" ON public.artigos_vinted;
DROP POLICY IF EXISTS "conversas_own" ON public.conversas;

CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "artigos_own" ON public.artigos FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "artigos_vinted_own" ON public.artigos_vinted FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "conversas_own" ON public.conversas FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
