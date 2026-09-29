-- Run this in the Supabase SQL editor (or `supabase db push` with the CLI)
-- to create the two tables this site uses.

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  locale text not null check (locale in ('en', 'es')),
  title text not null,
  excerpt text not null,
  content text not null,
  published_at timestamptz not null default now(),
  meta_title text,
  meta_description text,
  unique (slug, locale)
);

create table if not exists contact_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  email text not null,
  company text,
  message text not null,
  locale text not null default 'en'
);

-- Row Level Security: allow anon reads on published posts,
-- and anon inserts on contact_submissions (writes only, no read-back).
alter table posts enable row level security;
alter table contact_submissions enable row level security;

create policy "Public can read posts" on posts
  for select using (true);

create policy "Public can submit contact form" on contact_submissions
  for insert with check (true);
