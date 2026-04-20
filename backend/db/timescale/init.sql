-- TimescaleDB bootstrap for OHLCV storage
create extension if not exists timescaledb;

create table if not exists symbols (
  symbol text primary key,
  name text null
);

create table if not exists ohlcv (
  time timestamptz not null,
  symbol text not null references symbols(symbol),
  open double precision not null,
  high double precision not null,
  low double precision not null,
  close double precision not null,
  volume double precision not null,
  primary key (time, symbol)
);

select create_hypertable('ohlcv', by_range('time'), if_not_exists => true);

create index if not exists ix_ohlcv_symbol_time on ohlcv (symbol, time desc);

insert into symbols(symbol, name) values
  ('RELIANCE', 'Reliance Industries'),
  ('TCS', 'Tata Consultancy Services'),
  ('INFY', 'Infosys')
on conflict do nothing;

