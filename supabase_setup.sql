-- Cold Read — run this ONCE in Supabase: left sidebar → SQL Editor → New query → paste → Run.
-- If a line ever says "already exists", that's fine, ignore it.

-- One row per game = the shared state every phone reads/writes.
create table if not exists games (
  code         text primary key,
  host_id      text,
  phase        text default 'lobby',    -- lobby | playing | guessing | revealed
  difficulty   text default 'medium',   -- easy | medium | hard
  answer_mode  text default 'yesno',    -- yesno | scale
  seed         int  default 1,
  round        int  default 1,
  seer_id      text,
  suspect_idx  int,
  asked_q      text,
  seer_ans     jsonb,
  created_at   timestamptz default now()
);

-- One row per player in a game.
create table if not exists players (
  id         text primary key,
  code       text references games(code) on delete cascade,
  name       text,
  num        int,
  ready      boolean default false,
  guess      int,
  created_at timestamptz default now()
);

-- Demo access: no logins, anyone with the code can play. (Tighten later.)
alter table games   enable row level security;
alter table players enable row level security;
drop policy if exists demo_games   on games;
drop policy if exists demo_players on players;
create policy demo_games   on games   for all using (true) with check (true);
create policy demo_players on players for all using (true) with check (true);

-- Turn on realtime so changes push to every phone live.
alter publication supabase_realtime add table games;
alter publication supabase_realtime add table players;
