create extension if not exists postgis;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  account_type text not null check (account_type in ('customer','tradesperson','admin')),
  first_name text,
  last_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists tradesperson_profiles (
  user_id uuid primary key references profiles(id) on delete cascade,
  business_name text,
  primary_trade text not null,
  bio text,
  years_experience integer default 0,
  callout_fee numeric(10,2),
  is_verified boolean not null default false,
  is_insured boolean not null default false,
  is_gas_safe boolean not null default false,
  rating numeric(2,1) default 0,
  review_count integer not null default 0
);

create table if not exists availability_sessions (
  id uuid primary key default gen_random_uuid(),
  tradesperson_id uuid not null references profiles(id) on delete cascade,
  is_active boolean not null default true,
  started_at timestamptz not null default now(),
  ends_at timestamptz,
  max_radius_miles numeric(6,2) not null default 10
);

create table if not exists trade_locations (
  tradesperson_id uuid primary key references profiles(id) on delete cascade,
  position geography(point, 4326) not null,
  accuracy_meters numeric,
  updated_at timestamptz not null default now()
);
create index if not exists trade_locations_position_idx on trade_locations using gist(position);

create table if not exists job_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references profiles(id) on delete cascade,
  trade text not null,
  issue text not null,
  urgency text not null check (urgency in ('ASAP','Today','This week')),
  position geography(point, 4326),
  address_text text,
  status text not null default 'searching'
    check (status in ('searching','matched','booked','completed','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists job_matches (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references job_requests(id) on delete cascade,
  tradesperson_id uuid not null references profiles(id) on delete cascade,
  distance_miles numeric(7,2),
  eta_minutes integer,
  status text not null default 'offered'
    check (status in ('offered','accepted','declined','selected')),
  created_at timestamptz not null default now(),
  unique(job_id, tradesperson_id)
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references job_requests(id) on delete set null,
  customer_id uuid not null references profiles(id) on delete cascade,
  tradesperson_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id) on delete cascade,
  body text,
  media_url text,
  created_at timestamptz not null default now()
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references job_requests(id) on delete cascade,
  customer_id uuid not null references profiles(id) on delete cascade,
  tradesperson_id uuid not null references profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);
