create table public.watchlist_settings (
  email text primary key,
  from_name text not null default 'Stock Alerts',
  from_email text not null default 'onboarding@resend.dev',
  updated_at timestamptz not null default now()
);
alter table public.watchlist_settings enable row level security;
create policy "public read" on public.watchlist_settings for select using (true);
create policy "public insert" on public.watchlist_settings for insert with check (true);
create policy "public update" on public.watchlist_settings for update using (true);
create policy "public delete" on public.watchlist_settings for delete using (true);