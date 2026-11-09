-- Know Your Partner schema
create table if not exists kyp_rooms (
  code        text primary key,
  host_uid    text not null,
  host_name   text,
  guest_uid   text,
  guest_name  text,
  mode        text default 'newlywed',  -- newlywed or deepdive
  phase       text default 'lobby',     -- lobby, answer, wait, guess, results
  round       int  default 0,
  qids        text[] default '{}',
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists kyp_answers (
  room       text not null references kyp_rooms(code) on delete cascade,
  round      int  not null,
  slot       int  not null,
  qid        text,
  ans        int,
  guess      int,
  created_at timestamptz default now(),
  primary key (room, round, slot)
);

alter table kyp_rooms   enable row level security;
alter table kyp_answers enable row level security;

drop policy if exists "kyp_rooms_all" on kyp_rooms;
create policy "kyp_rooms_all" on kyp_rooms for all using (true) with check (true);

drop policy if exists "kyp_answers_all" on kyp_answers;
create policy "kyp_answers_all" on kyp_answers for all using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table kyp_rooms;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table kyp_answers;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
