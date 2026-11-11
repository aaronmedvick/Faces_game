-- GAME NIGHT: RESET. WIPES EVERYTHING (all games, lobbies, accounts, saved answers).
-- Run this once for a fresh start, then run supabase_setup.sql.
do $$
declare t text;
begin
  foreach t in array array[
    'hub_sessions','hub_accounts','hub_members','hub_lobbies',
    'pages','games','players','ld_games','ld_players','lms_rooms','users',
    'wt_rooms','wt_players','lt_rooms','lt_players','wag_rooms','wag_players',
    'gc_rooms','gc_players','gc_votes','hm_rooms','hm_players',
    'kd_rooms','kd_players','kd_people','kd_answers',
    'pt_rooms','pt_answers','pt_players','botc_rooms','botc_players'
  ] loop
    execute format('drop table if exists %I cascade', t);
  end loop;
end $$;
drop function if exists hub_hash(text,text);
drop function if exists hub_new_token(bigint);
drop function if exists hub_register(text,text,text,text,text);
drop function if exists hub_login(text,text);
drop function if exists hub_resume(text);
drop function if exists hub_logout(text);
drop function if exists hub_get_profile(text);
drop function if exists hub_update_profile(text,text,text,text,jsonb);
