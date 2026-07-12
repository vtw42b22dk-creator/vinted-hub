# Vinted Hub — Deploy (GitHub Pages + Supabase)

Site online igual ao Sinapse App: **GitHub Pages** + **Supabase Auth** + **Edge Functions** para a extensão.

## URL do site

https://vtw42b22dk-creator.github.io/vinted-hub/

---

## 1. Supabase — SQL (uma vez)

No [SQL Editor](https://supabase.com/dashboard/project/varmqpsxxmwtuxwltppn/sql/new):

1. `supabase/setup-completo.sql` — tabelas base
2. `supabase/auth-rls.sql` — login + RLS + sync secret por utilizador
3. `supabase/migration-conversas-estado.sql` — se ainda não correram as colunas `aberta_em` / `item_fechado`

## 2. Supabase — Edge Functions (sync extensão)

```powershell
cd C:\Users\marti\Projects\revenda-dashboard
npx supabase login
npx supabase link --project-ref varmqpsxxmwtuxwltppn
npx supabase functions deploy sync-artigos --no-verify-jwt
npx supabase functions deploy sync-conversas --no-verify-jwt
```

> `--no-verify-jwt` porque a extensão usa `x-sync-secret` em vez de JWT.

## 3. GitHub — Secrets + Pages

Repositório: https://github.com/vtw42b22dk-creator/vinted-hub

**Settings → Secrets and variables → Actions** — adiciona:

| Secret | Valor |
|--------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://varmqpsxxmwtuxwltppn.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave anon do Supabase |
| `NEXT_PUBLIC_SUPABASE_FUNCTIONS_URL` | `https://varmqpsxxmwtuxwltppn.supabase.co/functions/v1` |

**Settings → Pages → Build and deployment:**

- Source: **GitHub Actions**

Cada push para `main` publica automaticamente (workflow `.github/workflows/pages.yml`).

## 4. Extensão Chrome

1. `chrome://extensions` → Modo programador → Carregar pasta `extension/`
2. Cria conta no site → `/setup` → copia **Sync Secret**
3. Popup da extensão:
   - **URL Functions:** `https://varmqpsxxmwtuxwltppn.supabase.co/functions/v1`
   - **Sync Secret:** o teu secret pessoal

## 5. Desenvolvimento local

```powershell
cd C:\Users\marti\Projects\revenda-dashboard
npm install
npm run dev
```

Abre http://localhost:3000 — sem GitHub Pages basePath.

Para testar build de produção:

```powershell
$env:GITHUB_PAGES='true'; npm run build
npx serve out
```

---

## Arquitetura

```
Extensão Chrome (Vinted.pt)
        │ x-sync-secret
        ▼
Supabase Edge Functions (sync-artigos, sync-conversas)
        │
        ▼
Supabase DB (RLS por user_id)
        ▲
        │ login email/password
GitHub Pages (dashboard estático)
```
