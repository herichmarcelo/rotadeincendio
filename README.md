# Rota de Incêndio

Aplicativo web (Next.js App Router) com aparência mobile e integração Supabase: auditorias, unidades/setores, auditores, checklist da “Rota de Incêndio” com upload de fotos via **Cloudinary** (URLs salvas no Supabase).

## Requisitos

- Node.js 20+
- Projeto Supabase com o SQL aplicado (veja `supabase/schema.sql`)

## Configuração

1. Copie `.env.example` para `.env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

2. **Obrigatório:** no painel Supabase, projeto que corresponde à URL em `.env.local`, abra **SQL Editor** e execute **todo** o conteúdo de `supabase/schema.sql` (botão Run). Sem isso o app retorna erro **PGRST205** (“Could not find the table …”). Depois de rodar o script, as tabelas (`auditorias`, etc.) passam a existir.

3. Crie um usuário em **Authentication → Users** (e-mail/senha) para login no app.

4. Instale e rode:

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). O fluxo padrão redireciona para `/login` se não houver sessão.

### Cloudinary (fotos do checklist)

O upload usa o preset **`rota_incendio_upload`** no cloud **`dmcgufpyk`**, sem API secret no frontend. No [Cloudinary Console](https://console.cloudinary.com/):

1. **Settings** (ícone de engrenagem) → aba **Upload** → **Upload presets**.
2. Crie ou edite o preset **`rota_incendio_upload`**.
3. **Signing mode** / modo de assinatura deve ser **Unsigned** (é isso que o erro *“Upload preset must be whitelisted for unsigned uploads”* pede).
4. Salve. Se o nome do preset for outro, altere em `src/services/cloudinary.ts` (`upload_preset`).

## Estrutura principal

- `src/lib/supabaseClient.ts` — cliente browser (Client Components).
- `src/lib/supabase/server.ts` — cliente servidor (Server Components / actions).
- `src/middleware.ts` — renovação de sessão e proteção de rotas.
- `src/services/` — CRUD e regras (auditorias, dashboard, checklist, etc.).
- `src/hooks/` — `useAuth`, `useNotificationCounts`.
- `src/examples/crud-examples.ts` — exemplos de queries Supabase.

## PWA

`public/manifest.json` e metadados em `src/app/layout.tsx` deixam o app instalável; ajuste ícones em `public/icons/` se desejar.
