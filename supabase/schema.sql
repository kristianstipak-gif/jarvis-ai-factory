create table if not exists public.market_snapshots (
  id bigint generated always as identity primary key,
  mint text not null,
  pair text,
  observed_at timestamptz not null,
  price_usd numeric,
  liquidity_usd numeric,
  volume_24h numeric,
  txns_24h integer,
  buys_24h integer,
  sells_24h integer,
  holder_count integer,
  top10_share numeric,
  unique_owners_top20 integer,
  created_at timestamptz not null default now()
);

create unique index if not exists market_snapshots_mint_pair_observed_key
  on public.market_snapshots (mint, pair, observed_at);

create index if not exists market_snapshots_mint_observed_idx
  on public.market_snapshots (mint, observed_at);

alter table public.market_snapshots enable row level security;
