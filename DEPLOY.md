# Deploy — Vinted Hub como site online

Publicar o dashboard na internet com **GitHub + Vercel** (grátis).

---

## Visão geral

```
GitHub (código)  →  Vercel (site online)  →  Supabase (dados)
       ↑
Extensão Chrome envia sync para o URL do Vercel
```

URL final exemplo: `https://vinted-hub.vercel.app`

---

## Passo 1 — Instalar Git

Se ainda não tens Git:

1. Descarrega: https://git-scm.com/download/win
2. Instala (Next → Next, deixa tudo por defeito)
3. **Fecha e reabre** o terminal / Cursor

---

## Passo 2 — Criar repositório no GitHub

1. Vai a https://github.com/new
2. Nome: `vinted-hub` (ou `revenda-dashboard`)
3. **Private** (recomendado — é o teu negócio)
4. **Não** marques README (já tens código local)
5. Clica **Create repository**

---

## Passo 3 — Enviar código para o GitHub

No PowerShell:

```powershell
cd C:\Users\marti\Projects\revenda-dashboard

git init
git add .
git commit -m "Initial commit: Vinted Hub dashboard"
git branch -M main
git remote add origin https://github.com/TEU_USER/vinted-hub.git
git push -u origin main
```

Substitui `TEU_USER` pelo teu username GitHub.

> GitHub pode pedir login — usa **Personal Access Token** como password.

---

## Passo 4 — Deploy na Vercel (site online)

1. Vai a https://vercel.com e regista-te com **GitHub**
2. **Add New Project**
3. Importa o repositório `vinted-hub`
4. Em **Environment Variables**, adiciona:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://varmqpsxxmwtuxwltppn.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (a tua publishable key) |
| `SYNC_SECRET` | `revenda-sync-2026-secreto` |

5. Clica **Deploy**
6. Espera ~2 min — recebes um URL tipo `https://vinted-hub.vercel.app`

---

## Passo 5 — Atualizar extensão Chrome

No popup da extensão, muda:

- **URL do Dashboard:** `https://vinted-hub.vercel.app` (o teu URL Vercel)
- **Sync Secret:** `revenda-sync-2026-secreto`

Recarrega a extensão em `chrome://extensions`.

---

## Passo 6 — Supabase (permitir o site)

No Supabase → **Authentication** → **URL Configuration**:

- **Site URL:** `https://vinted-hub.vercel.app`

(Só necessário se activares login mais tarde.)

---

## Atualizações futuras

Depois de alterar código:

```powershell
git add .
git commit -m "Descrição da alteração"
git push
```

A Vercel **atualiza o site automaticamente** em ~1 minuto.

---

## Alternativa sem terminal: GitHub Desktop

1. Instala https://desktop.github.com
2. **File → Add local repository** → pasta `revenda-dashboard`
3. **Publish repository** → Private
4. Depois segue Passo 4 (Vercel)

---

## Local vs Online

| | Local (`localhost`) | Online (Vercel) |
|---|---|---|
| Acesso | Só no teu PC | PC, iPad, telemóvel |
| Precisa terminal | Sim | Não |
| Sync extensão | `http://localhost:3000` | `https://teu-site.vercel.app` |
