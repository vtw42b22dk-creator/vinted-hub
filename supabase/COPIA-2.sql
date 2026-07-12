CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  INSERT INTO public.profiles (id, sync_secret)
  VALUES (NEW.id, encode(gen_random_bytes(24), 'hex'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.profiles (id, sync_secret)
SELECT id, encode(gen_random_bytes(24), 'hex') FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

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
