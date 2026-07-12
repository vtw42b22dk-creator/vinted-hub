-- ============================================================
-- Tabela principal: artigos
-- Executar no Supabase SQL Editor
-- ============================================================

CREATE TABLE public.artigos (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT now(),
  nome                 TEXT NOT NULL,
  marca                TEXT,
  tamanho              TEXT,
  estado_artigo        TEXT NOT NULL DEFAULT 'Bom'
                         CHECK (estado_artigo IN ('Novo', 'Excelente', 'Bom', 'Satisfatório')),
  preco_custo          NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (preco_custo >= 0),
  preco_venda_previsto NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (preco_venda_previsto >= 0),
  preco_venda_real     NUMERIC(10, 2) CHECK (preco_venda_real IS NULL OR preco_venda_real >= 0),
  foto_url             TEXT,
  status               TEXT NOT NULL DEFAULT 'Em Stock'
                         CHECK (status IN ('Em Stock', 'Reservado', 'Vendido', 'Para Embalar', 'Enviado'))
);

CREATE INDEX idx_artigos_status ON public.artigos (status);
CREATE INDEX idx_artigos_criado_em ON public.artigos (criado_em DESC);

ALTER TABLE public.artigos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilizadores autenticados podem ver artigos"
  ON public.artigos FOR SELECT TO authenticated USING (true);

CREATE POLICY "Utilizadores autenticados podem inserir artigos"
  ON public.artigos FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Utilizadores autenticados podem atualizar artigos"
  ON public.artigos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Utilizadores autenticados podem apagar artigos"
  ON public.artigos FOR DELETE TO authenticated USING (true);

-- ============================================================
-- Storage: criar bucket "artigos-fotos" (público) no dashboard
-- Depois executar as políticas abaixo:
-- ============================================================

CREATE POLICY "Leitura pública das fotos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'artigos-fotos');

CREATE POLICY "Upload autenticado"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'artigos-fotos');

CREATE POLICY "Atualização autenticada"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'artigos-fotos');

CREATE POLICY "Eliminação autenticada"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'artigos-fotos');
