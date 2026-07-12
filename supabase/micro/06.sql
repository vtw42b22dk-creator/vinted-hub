CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  sync_secret TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
