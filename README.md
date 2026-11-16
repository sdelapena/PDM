# PDM · Product Development Manager (Justin)

Tracks every footwear style from Project Brief to production, per factory (T1). Built from `PDM_Especificacion_v1`.

Stack: Next.js (App Router) · Prisma · PostgreSQL (Supabase) · Supabase Storage (photos) · SendGrid (email) · Vercel.

## Deploy (Vercel + Supabase)

1. **Supabase**: create a project. In Storage, create a **public** bucket named `pdm-photos`.
2. **SendGrid**: create an API key and verify the sender address or domain.
3. **Vercel**: import this repository and set every variable from `.env.example`. Set the build command to
   `npm run vercel-build` so each deploy applies the migrations and loads the initial data.
4. **First data load**: happens during the deploy when `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` are set.
   The seed creates the Admin with those credentials, the Justin users, the companies and the 23 Vaqueras/Dante
   styles from the monday.com board. It is safe to run again: existing rows are skipped, and the Admin password
   is only used the first time. Once the Admin can sign in, both variables can be removed from Vercel.
5. Sign in as the Admin, open **Menu → User Management** and replace each placeholder email with the real one.
   Each user then receives a link to choose their password.

## Local development

```bash
cp .env.example .env   # fill DATABASE_URL, DIRECT_URL, AUTH_SECRET, SEED_ADMIN_*
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Without SendGrid variables, emails are printed to the server log. Without Supabase variables, photos are saved to
`public/uploads` (development only).

## Where things are

| Path | Contents |
|---|---|
| `lib/catalog.ts` | The 31 subitems: sections, valid statuses, fields, default owners |
| `lib/logic.ts` | Calculated rules: alerts, style status, progress bar, formats |
| `lib/perm.ts` | Permission matrix, enforced by every route in `app/api` |
| `app/api/subitems/[id]/route.ts` | Subitem edits: automatic dates, rounds, history, notifications |
| `prisma/schema.prisma` | Data model |
| `prisma/monday.json` | Styles imported from monday.com |
| `components/` | Screens (board, panels, management, T2 list, sign-in) |
