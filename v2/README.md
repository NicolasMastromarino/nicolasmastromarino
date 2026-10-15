# nicolasmastromarino.com

Freelance CRM implementation, management, and marketing-automation consulting site for Nicolás Mastromarino. Next.js (App Router) + TypeScript + Tailwind CSS v4, bilingual (EN/ES) via `next-intl`, data via Supabase, deployed on Vercel.

## Local development

```bash
npm install
npm run dev
```

The site works locally with **no Supabase or booking link configured** — the contact form will show a friendly "not connected yet" message instead of erroring, and the blog will show an empty state. To wire those up:

## 1. Supabase (blog posts + contact form)

1. Create a free project at [supabase.com](https://supabase.com).
2. Open the SQL editor and run everything in [`supabase.sql`](./supabase.sql) — it creates the `posts` and `contact_submissions` tables with the right row-level-security policies.
3. Copy `.env.local.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Project Settings → API in Supabase.
4. To publish a blog post, insert a row into `posts` (via the Supabase table editor, or SQL). `content` is Markdown. Add one row per locale (`en` / `es`) with the same `slug` if you want the post in both languages — they're independent rows, so you can publish English first and translate later.

## 2. Booking link

Set `NEXT_PUBLIC_BOOKING_URL` in `.env.local` to your Calendly, Cal.com, or similar scheduling link. Until it's set, the Contact page shows the message-form option only.

## 3. Deploying to Vercel

1. Push this repo to GitHub.
2. Import it in [Vercel](https://vercel.com/new).
3. Add the same environment variables from `.env.local` in the Vercel project settings (Production + Preview).
4. Set `NEXT_PUBLIC_SITE_URL` to `https://nicolasmastromarino.com` (used for the sitemap, robots.txt, and Open Graph tags).
5. Point the `nicolasmastromarino.com` domain at the Vercel project (Vercel's domain settings will give you the DNS records to add).

## Project structure

- `src/app/[locale]/` — all pages, one folder per route, each with an `en` and `es` render via `next-intl`.
- `src/messages/{en,es}.json` — all UI copy. Case studies and most page content live here too (not in a CMS) since they're not expected to change often; blog posts are the one thing meant to be added over time, and those live in Supabase.
- `src/components/` — shared UI: `ticket-card.tsx` (the core visual component — see `DESIGN.md`), `cta-link.tsx`, header/footer, contact form.
- `src/lib/` — Supabase client and blog post queries.
- `supabase.sql` — run once in a new Supabase project.
- `DESIGN.md` — the visual system this site is built in, for future work to stay consistent.

## Notes

- Case studies are sanitized/representative — no real client or employer names, per the product brief. See `PRODUCT.md`.
- The `middleware.ts` file triggers a Next.js 16 deprecation warning ("use proxy instead") at build time. It still works correctly; `next-intl`'s own docs use `middleware.ts`, so this was left as-is rather than migrating ahead of upstream guidance.
