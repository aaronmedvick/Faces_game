-- GAME NIGHT: FULL SETUP. Safe to re-run any time (it never deletes data).
-- Supabase -> SQL Editor -> New query -> paste -> Run.
-- Fresh start? Run supabase_reset.sql FIRST (it wipes everything), then this file.
-- Contains: accounts (username + password, hashed), lobby, every game's tables, the home-screen game list.

-- 1. HUB REGISTRY -------------------------------------------------------
create table if not exists pages (
  slug text primary key, name text, tag text, emoji text, url text,
  descr text, status text default 'soon', sort int default 0
);

-- 2. COLD READ ----------------------------------------------------------
create table if not exists games (
  code text primary key, host_id text, phase text default 'lobby',
  difficulty text default 'medium', answer_mode text default 'yesno',
  seed int default 1, round int default 1, seer_id text, suspect_idx int,
  asked_q text, seer_ans jsonb, history jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);
alter table games add column if not exists history jsonb default '[]'::jsonb;

-- players is shared by Cold Read and Last Man Standing
create table if not exists players (
  id text primary key, code text, name text, num int,
  ready boolean default false, guess int, created_at timestamptz default now()
);
alter table players drop constraint if exists players_code_fkey;
alter table players add column if not exists game_key text;
alter table players add column if not exists vote    int;
alter table players add column if not exists freed   jsonb default '[]'::jsonb;
alter table players add column if not exists stars   jsonb default '[]'::jsonb;
alter table players add column if not exists answers jsonb default '{}'::jsonb;
alter table players add column if not exists alive   boolean default true;
alter table players add column if not exists pick    int;

-- 3. LIAR'S DICE / POKER ------------------------------------------------
create table if not exists ld_games (
  code text primary key, host_id text, phase text default 'lobby', round int default 0,
  wild boolean default false, spoton boolean default false, autonext boolean default false,
  mode text default 'dice', dollars boolean default false,
  bid jsonb, pending jsonb, last_action jsonb, turn int, starter int, winner text,
  created_at timestamptz default now()
);
create table if not exists ld_players (
  id text primary key, code text, name text, num int, dice jsonb default '[]'::jsonb,
  alive boolean default true, ready boolean default false, wins int default 0,
  created_at timestamptz default now()
);
alter table ld_games add column if not exists autonext    boolean default false;
alter table ld_games add column if not exists mode        text default 'dice';
alter table ld_games add column if not exists dollars     boolean default false;
alter table ld_games add column if not exists last_action jsonb;
alter table ld_games add column if not exists starter     int;
alter table ld_games add column if not exists winner      text;

-- 4. LAST MAN STANDING --------------------------------------------------
create table if not exists lms_rooms (
  code text primary key, host_id text, phase text default 'lobby', round int default 0,
  state jsonb default '{}'::jsonb, created_at timestamptz default now()
);
create table if not exists users (
  id text primary key, name text, last_seen timestamptz default now()
);

-- 5. WHATCHA THINKING ---------------------------------
create table if not exists wt_rooms (
  code text primary key, host_id text, mode text, phase text default 'lobby', round int default 0,
  thinker_id text, question jsonb, secret numeric, high_id text, high_bid numeric,
  tick_high numeric, deadline bigint, tick int default 0, last_event text, outcome jsonb,
  created_at timestamptz default now()
);
create table if not exists wt_players (
  id text primary key, code text, name text, color text, score numeric default 0,
  bid numeric, locked boolean default false, acted boolean default false,
  joined_at timestamptz default now()
);

-- 6. WITS & WAGERS (wagers.html) ----------------------------------------
create table if not exists wag_rooms (
  code text primary key, host_id text, phase text default 'lobby',
  difficulty text default 'ramp', round int default 0, question jsonb,
  used jsonb default '[]'::jsonb, board jsonb, outcome jsonb, deadline bigint,
  vote_mode text default 'together', allow_change boolean default true,
  vote_order jsonb, turn int default 0, created_at timestamptz default now()
);
create table if not exists wag_players (
  id text primary key, code text references wag_rooms(code) on delete cascade,
  name text, color text, score int default 0, guess bigint, bet int,
  joined_at timestamptz default now()
);
alter table wag_rooms add column if not exists difficulty   text default 'ramp';
alter table wag_rooms add column if not exists used         jsonb default '[]'::jsonb;
alter table wag_rooms add column if not exists board        jsonb;
alter table wag_rooms add column if not exists outcome      jsonb;
alter table wag_rooms add column if not exists deadline     bigint;
alter table wag_rooms add column if not exists vote_mode    text default 'together';
alter table wag_rooms add column if not exists allow_change boolean default true;
alter table wag_rooms add column if not exists vote_order   jsonb;
alter table wag_rooms add column if not exists turn         int default 0;
alter table wag_players add column if not exists guess bigint;
alter table wag_players add column if not exists bet   int;

-- 7. GUT CHECK (gutcheck.html) ------------------------------------------
create table if not exists gc_rooms (
  code text primary key, host_id text not null, phase text not null default 'lobby',
  round int not null default 0, rounds int not null default 8, prompt jsonb,
  used jsonb default '[]'::jsonb, reader_id text, results jsonb,
  history jsonb default '[]'::jsonb, packs jsonb, off jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);
create table if not exists gc_players (
  id text primary key, code text not null, name text not null, color text,
  score int not null default 0, vote int, locked boolean not null default false,
  bot boolean not null default false, gain int not null default 0, target_id text,
  joined_at timestamptz default now()
);
alter table gc_rooms   add column if not exists rounds  int not null default 8;
alter table gc_rooms   add column if not exists results jsonb;
alter table gc_rooms   add column if not exists history jsonb default '[]'::jsonb;
alter table gc_rooms   add column if not exists packs   jsonb;
alter table gc_rooms   add column if not exists off     jsonb default '[]'::jsonb;
alter table gc_players add column if not exists gain      int not null default 0;
alter table gc_players add column if not exists bot       boolean not null default false;
alter table gc_players add column if not exists target_id text;
create index if not exists gc_players_code_idx on gc_players(code);
create table if not exists gc_votes (
  id bigserial primary key, prompt_key text not null, adj text, subject text,
  vote int not null, players int, created_at timestamptz default now()
);
create index if not exists gc_votes_key_idx on gc_votes(prompt_key);

-- 8. THE HERD (herd.html) -----------------------------------------------
create table if not exists hm_rooms (
  code text primary key, host_id text, phase text default 'lobby', round int default 0,
  question text, options jsonb, used jsonb default '[]'::jsonb, deadline bigint,
  outcome jsonb, hist jsonb default '[]'::jsonb, created_at timestamptz default now()
);
create table if not exists hm_players (
  id text primary key, code text, name text, color text, score int default 0,
  pick int, pick_ms int, joined_at timestamptz default now()
);
alter table hm_rooms   add column if not exists options jsonb;
alter table hm_rooms   add column if not exists used    jsonb default '[]'::jsonb;
alter table hm_rooms   add column if not exists outcome jsonb;
alter table hm_rooms   add column if not exists deadline bigint;
alter table hm_rooms   add column if not exists hist    jsonb default '[]'::jsonb;
alter table hm_players add column if not exists pick    int;
alter table hm_players add column if not exists pick_ms int;

-- 9. KINDRED (kindred.html) ---------------------------------------------
create table if not exists kd_rooms (
  code text primary key, host_id text, mode text default 'duo', phase text default 'lobby',
  total int default 10, idx int default 0, qids jsonb default '[]'::jsonb,
  guess boolean default true, gen int default 0, created_at timestamptz default now()
);
create table if not exists kd_players (
  id text primary key, code text references kd_rooms(code) on delete cascade,
  name text, color text, bot boolean default false, persona text,
  hist jsonb default '{}'::jsonb, joined_at timestamptz default now()
);
create table if not exists kd_people (
  uid text primary key, name text, color text, updated_at timestamptz default now()
);
create table if not exists kd_answers (
  uid text not null, qid text not null, val jsonb not null,
  updated_at timestamptz default now(), primary key (uid, qid)
);
create index if not exists kd_answers_qid on kd_answers (qid);

-- 10. PILLOW TALK (pillowtalk.html) -------------------------------------
create table if not exists pt_rooms (
  code text primary key, host_uid text not null, host_name text, guest_uid text,
  guest_name text, heat text default 'flirty', rounds int default 12,
  phase text default 'lobby', round int default 0, cards jsonb default '[]'::jsonb,
  bot boolean default false, created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create table if not exists pt_answers (
  room text not null references pt_rooms(code) on delete cascade,
  round int not null, slot int not null, val int, guess int,
  created_at timestamptz default now(), primary key (room, round, slot)
);

-- 10b. PILLOW TALK: groups (any number of players, partners rotate each round)
alter table pt_rooms add column if not exists seats jsonb default '[]'::jsonb;
create table if not exists pt_players (
  room text not null references pt_rooms(code) on delete cascade,
  uid text not null, name text, joined_at timestamptz default now(),
  primary key (room, uid)
);

-- 11. CLOCKTOWER (clocktower.html) --------------------------------------
create table if not exists botc_rooms (
  code text primary key, host_id text, mode text default 'storyteller',
  phase text default 'lobby', day_num int default 0, night_num int default 0,
  script text default 'trouble_brewing', nomination jsonb, on_block jsonb,
  settings jsonb default '{}'::jsonb, winner text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create table if not exists botc_players (
  id text primary key, code text references botc_rooms(code) on delete cascade,
  seat int, name text, role text, role_type text, alive boolean default true,
  used_ghost_vote boolean default false, night_action jsonb, minigame jsonb default '{}'::jsonb,
  is_storyteller boolean default false, joined_at timestamptz default now()
);
alter table botc_players add column if not exists auto_info jsonb;
alter table botc_players add column if not exists auto_team text;
create index if not exists botc_players_code_idx on botc_players (code);
create index if not exists botc_players_seat_idx on botc_players (code, seat);

-- A. ACCOUNTS: username + password. Hashed server-side; the app can only call the functions below.
create table if not exists hub_accounts (
  id bigint generated always as identity primary key,
  uid text unique not null,                 -- the stable id every game uses, so history follows you
  username text unique not null,            -- lowercase
  display_name text not null,
  salt text not null, pass_hash text not null,
  email text, phone text,
  profile jsonb default '{}'::jsonb,        -- free-form: company, role, links (Table Networking)
  created_at timestamptz default now(), last_login timestamptz
);
create table if not exists hub_sessions (
  token text primary key,
  account_id bigint not null references hub_accounts(id) on delete cascade,
  created_at timestamptz default now(), last_used timestamptz default now()
);
alter table hub_accounts enable row level security;     -- no policies: the public key cannot read or write these directly
alter table hub_sessions enable row level security;
revoke all on hub_accounts from anon, authenticated;
revoke all on hub_sessions from anon, authenticated;

create or replace function hub_hash(p_salt text, p_pw text) returns text
language plpgsql immutable as $$
declare h bytea := convert_to(p_salt || ':' || p_pw, 'UTF8'); i int;
begin
  for i in 1..20000 loop h := sha256(h || convert_to(p_salt, 'UTF8')); end loop;
  return encode(h, 'hex');
end $$;

create or replace function hub_new_token(p_account bigint) returns text
language plpgsql security definer set search_path = public as $$
declare t text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  insert into hub_sessions(token, account_id) values (t, p_account);
  delete from hub_sessions where account_id = p_account and last_used < now() - interval '90 days';
  return t;
end $$;

create or replace function hub_register(p_username text, p_password text, p_display text,
                                        p_email text default null, p_phone text default null) returns json
language plpgsql security definer set search_path = public as $$
declare u text := lower(trim(coalesce(p_username,''))); d text := trim(coalesce(p_display,'')); v_id bigint; v_uid text; v_salt text;
begin
  if u !~ '^[a-z0-9_.-]{3,24}$' then return json_build_object('error','Username: 3 to 24 letters, numbers, dot, dash or underscore.'); end if;
  if length(coalesce(p_password,'')) < 6 then return json_build_object('error','Password must be at least 6 characters.'); end if;
  if d = '' then d := u; end if;
  if length(d) > 24 then d := left(d, 24); end if;
  if exists (select 1 from hub_accounts where username = u) then return json_build_object('error','That username is taken.'); end if;
  v_uid := 'a_' || substr(replace(gen_random_uuid()::text,'-',''), 1, 12);
  v_salt := replace(gen_random_uuid()::text,'-','');
  insert into hub_accounts(uid, username, display_name, salt, pass_hash, email, phone, last_login)
    values (v_uid, u, d, v_salt, hub_hash(v_salt, p_password), nullif(trim(coalesce(p_email,'')),''), nullif(trim(coalesce(p_phone,'')),''), now())
    returning id into v_id;
  return json_build_object('token', hub_new_token(v_id), 'uid', v_uid, 'username', u, 'display_name', d);
end $$;

create or replace function hub_login(p_username text, p_password text) returns json
language plpgsql security definer set search_path = public as $$
declare a hub_accounts%rowtype;
begin
  select * into a from hub_accounts where username = lower(trim(coalesce(p_username,'')));
  if not found or a.pass_hash <> hub_hash(a.salt, coalesce(p_password,'')) then
    return json_build_object('error','Wrong username or password.');
  end if;
  update hub_accounts set last_login = now() where id = a.id;
  return json_build_object('token', hub_new_token(a.id), 'uid', a.uid, 'username', a.username, 'display_name', a.display_name);
end $$;

create or replace function hub_resume(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare a hub_accounts%rowtype;
begin
  select ac.* into a from hub_sessions s join hub_accounts ac on ac.id = s.account_id where s.token = p_token;
  if not found then return json_build_object('error','Session expired. Log in again.'); end if;
  update hub_sessions set last_used = now() where token = p_token;
  return json_build_object('uid', a.uid, 'username', a.username, 'display_name', a.display_name);
end $$;

create or replace function hub_logout(p_token text) returns json
language plpgsql security definer set search_path = public as $$
begin delete from hub_sessions where token = p_token; return json_build_object('ok', true); end $$;

create or replace function hub_get_profile(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare a hub_accounts%rowtype;
begin
  select ac.* into a from hub_sessions s join hub_accounts ac on ac.id = s.account_id where s.token = p_token;
  if not found then return json_build_object('error','Session expired. Log in again.'); end if;
  return json_build_object('uid', a.uid, 'username', a.username, 'display_name', a.display_name, 'email', a.email, 'phone', a.phone, 'profile', a.profile);
end $$;

create or replace function hub_update_profile(p_token text, p_display text default null, p_email text default null,
                                              p_phone text default null, p_profile jsonb default null) returns json
language plpgsql security definer set search_path = public as $$
declare a hub_accounts%rowtype;
begin
  select ac.* into a from hub_sessions s join hub_accounts ac on ac.id = s.account_id where s.token = p_token;
  if not found then return json_build_object('error','Session expired. Log in again.'); end if;
  update hub_accounts set
    display_name = coalesce(nullif(left(trim(coalesce(p_display,'')),24),''), display_name),
    email = coalesce(nullif(trim(coalesce(p_email,'')),''), email),
    phone = coalesce(nullif(trim(coalesce(p_phone,'')),''), phone),
    profile = case when p_profile is null then profile else profile || p_profile end
  where id = a.id returning * into a;
  return json_build_object('uid', a.uid, 'username', a.username, 'display_name', a.display_name, 'email', a.email, 'phone', a.phone, 'profile', a.profile);
end $$;

revoke all on function hub_hash(text,text) from public, anon, authenticated;
revoke all on function hub_new_token(bigint) from public, anon, authenticated;
grant execute on function hub_register(text,text,text,text,text) to anon, authenticated;
grant execute on function hub_login(text,text) to anon, authenticated;
grant execute on function hub_resume(text) to anon, authenticated;
grant execute on function hub_logout(text) to anon, authenticated;
grant execute on function hub_get_profile(text) to anon, authenticated;
grant execute on function hub_update_profile(text,text,text,text,jsonb) to anon, authenticated;

-- B. LOBBY: one 4-letter code; the host picks the game; everyone readies up; host starts.
create table if not exists hub_lobbies (
  code text primary key, host_uid text, game text, phase text default 'idle',
  nonce bigint default 0, created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table hub_lobbies add column if not exists host_uid text;
alter table hub_lobbies add column if not exists phase text default 'idle';
alter table hub_lobbies add column if not exists nonce bigint default 0;
create table if not exists hub_members (
  uid text primary key, code text, name text, ready boolean default false, here text,
  joined_at timestamptz default now(), last_seen timestamptz default now()
);
alter table hub_members add column if not exists ready boolean default false;
alter table hub_members add column if not exists here text;
create index if not exists hub_members_code_idx on hub_members (code);

-- C. OPEN ACCESS + REALTIME for the lobby and every game table (accounts above stay locked)
do $$
declare t text;
begin
  foreach t in array array[
    'pages','games','players','ld_games','ld_players','lms_rooms','users',
    'wt_rooms','wt_players','wag_rooms','wag_players','gc_rooms','gc_players','gc_votes',
    'hm_rooms','hm_players','kd_rooms','kd_players','kd_people','kd_answers',
    'pt_rooms','pt_answers','pt_players','botc_rooms','botc_players','hub_lobbies','hub_members'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists demo_all on %I', t);
    execute format('create policy demo_all on %I for all using (true) with check (true)', t);
  end loop;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'games','players','ld_games','ld_players','lms_rooms','wt_rooms','wt_players',
    'wag_rooms','wag_players','gc_rooms','gc_players','hm_rooms','hm_players','kd_rooms','kd_players',
    'pt_rooms','pt_answers','pt_players','botc_rooms','botc_players','hub_lobbies','hub_members'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when others then null;
    end;
  end loop;
end $$;

-- D. THE HOME-SCREEN GAME LIST (admin.html edits this). Matches by url, so no duplicates.
insert into pages (slug, name, tag, emoji, url, descr, status, sort)
select v.slug, v.name, v.tag, v.emoji, v.url, v.descr, 'demo', v.sort
from (values
  ('coldcase','Cold Read','Psychic detective','◍','coldcase.html','A crime, a lineup of strangers, and a pendulum that only says yes or no.',10),
  ('liarsdice','Liar''s Dice','Bluff & bid','🎲','liars-dice.html','Roll, hide, and bluff. Includes a Liar''s Poker dollar-bill mode.',20),
  ('lastman','Last Man Standing','Survival party','🏆','lastman.html','Pick the safe door each round. Outlast everyone.',30),
  ('whatcha','Whatcha Thinking','Sealed-bid guessing','🤔','whatcha.html','Someone holds a secret number. Bid, bluff, and out-guess the table.',40),
  ('tvcompanion','TV Companion','Reality-TV game','📺','tv_companion.html','Rate the cast, predict the eliminations, score the season.',50),
  ('officebuddy','Office Buddy','Novelty','🙂','Buddy/buddy.html','A cartoon Aaron that blurts out jokes.',60),
  ('wagers','Wits & Wagers','Trivia wagering','🎯','wagers.html','Guess the number, then bet on whose guess lands closest.',70),
  ('gutcheck','Gut Check','Dial it in','🎚️','gutcheck.html','Dial 0 to 100 and land on the same number as your assigned player.',80),
  ('herd','The Herd','Herd mentality','🐑','herd.html','Everyone secretly picks one of five answers. Score by matching the room.',90),
  ('kindred','Kindred','Same wavelength','🧵','kindred.html','Everyone answers the same questions. See who answers like you.',100),
  ('pillowtalk','Pillow Talk','Couples quiz (2 players)','💕','pillowtalk.html','Rate each other. Guess. Find out who is really paying attention.',110),
  ('brainybender','Brainy Bender','Speed quiz','🧠','brainybender.html','Silly and trick questions against a burning candle.',120),
  ('clocktower','Blood on the Clocktower','Social deduction','🕯️','clocktower.html','Trouble Brewing with a Storyteller, or host-less and run by the app.',130)
) as v(slug,name,tag,emoji,url,descr,sort)
where not exists (select 1 from pages p where p.url = v.url or p.slug = v.slug);

update pages set status = 'demo'
where status in ('soon','off') and url in ('coldcase.html','liars-dice.html','lastman.html','whatcha.html','tv_companion.html',
  'Buddy/buddy.html','wagers.html','gutcheck.html','herd.html','kindred.html','pillowtalk.html','brainybender.html','clocktower.html');

notify pgrst, 'reload schema';
