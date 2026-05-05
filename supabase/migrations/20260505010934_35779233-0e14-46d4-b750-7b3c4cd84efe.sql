
create table public.watchlist_alerts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  symbol text not null,
  threshold_pct numeric not null default 3,
  last_price numeric,
  last_news_id bigint,
  last_alerted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (email, symbol)
);

alter table public.watchlist_alerts enable row level security;

create policy "public read" on public.watchlist_alerts for select using (true);
create policy "public insert" on public.watchlist_alerts for insert with check (true);
create policy "public update" on public.watchlist_alerts for update using (true);
create policy "public delete" on public.watchlist_alerts for delete using (true);

create index on public.watchlist_alerts (email);
create index on public.watchlist_alerts (symbol);

create extension if not exists pg_cron;
create extension if not exists pg_net;
