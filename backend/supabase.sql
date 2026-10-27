-- Sly Escape global scoreboard - Supabase (Postgres) setup. Paste into Supabase > SQL Editor > Run (safe to re-run).
-- One row per (map, player): the player's BEST score on that map's last level.
-- Clients use the public anon key and can only call the 3 functions below + read the top-50 view.

-- 1) per-map plausible score ceiling (generated from the game's level data: all objects' points x max combo x10, +25% margin)
create table if not exists public.map_limits(
  map_id    text primary key,
  max_score integer not null check (max_score > 0),
  name      text not null);
insert into public.map_limits(map_id,max_score,name) values
  ('farm1', 13900, 'Meadow'),
  ('farm2', 20100, 'Snowy Farm'),
  ('farm3', 18800, 'Night Farm'),
  ('farm4', 16700, 'Pond'),
  ('farm5', 25700, 'Orchard'),
  ('farm6', 37100, 'Pumpkin Patch'),
  ('farm7', 26800, 'Barnyard'),
  ('farm8', 29800, 'Vineyard'),
  ('farm9', 37500, 'Harvest Fair'),
  ('farm10', 33200, 'Giant Ranch'),
  ('space', 23400, 'Space Station'),
  ('moon', 21200, 'The Moon'),
  ('ocean', 19600, 'Ocean'),
  ('minigolf', 21800, 'Mini Golf'),
  ('candy', 18500, 'Candy Kingdom'),
  ('dino', 17900, 'Dinosaur Jungle'),
  ('pirate', 16100, 'Pirate Island'),
  ('haunted', 19100, 'Haunted Mansion'),
  ('toys', 16900, 'Toy Room'),
  ('west', 17500, 'Wild West')
on conflict (map_id) do update set max_score=excluded.max_score, name=excluded.name;

-- 2) scores
create table if not exists public.scores(
  map_id      text not null references public.map_limits(map_id),
  player_id   uuid not null,                      -- random per-install UUID made by the game (no account, no personal data)
  nickname    text not null check (char_length(nickname) between 3 and 14 and nickname ~ '^[A-Za-z0-9 _-]+$'),
  score       integer not null check (score > 0),
  head_id     text not null default 'default' check (char_length(head_id) <= 32 and head_id ~ '^[a-z0-9_]+$'),
  app_version text check (char_length(app_version) <= 20),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (map_id, player_id));
create index if not exists scores_rank_idx on public.scores(map_id, score desc, updated_at);

-- 3) row-level security: anyone may read; inserts must be plausible; NO update/delete from clients
alter table public.scores enable row level security;
alter table public.map_limits enable row level security;
drop policy if exists scores_read on public.scores;
create policy scores_read on public.scores for select to anon, authenticated using (true);
drop policy if exists scores_insert on public.scores;
create policy scores_insert on public.scores for insert to anon, authenticated
  with check (score <= (select l.max_score from public.map_limits l where l.map_id = scores.map_id));
drop policy if exists limits_read on public.map_limits;
create policy limits_read on public.map_limits for select to anon, authenticated using (true);
revoke update, delete, truncate on public.scores from anon, authenticated;
revoke insert, update, delete, truncate on public.map_limits from anon, authenticated;
-- the game never reads player_id of others (top lists come from get_top, which only returns is_me)
revoke select on public.scores from anon, authenticated;
grant select (map_id, nickname, score, head_id, updated_at) on public.scores to anon, authenticated;

-- 4) submit: insert or keep the MAX (the only way a row changes). Validates range + simple per-player rate limit.
create or replace function public.submit_score(p_map text, p_player uuid, p_nick text, p_score integer, p_head text default 'default', p_ver text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare lim integer; last timestamptz; best integer;
begin
  select max_score into lim from map_limits where map_id = p_map;
  if lim is null then raise exception 'unknown map' using errcode = '22023'; end if;
  if p_score is null or p_score <= 0 or p_score > lim then raise exception 'implausible score' using errcode = '22023'; end if;
  p_nick := btrim(regexp_replace(coalesce(p_nick,''), '\s+', ' ', 'g'));
  if p_head is null or p_head !~ '^[a-z0-9_]{1,32}$' then p_head := 'default'; end if;
  select updated_at into last from scores where map_id = p_map and player_id = p_player;
  if last is not null and last > now() - interval '5 seconds' then raise exception 'too fast' using errcode = '22023'; end if;
  insert into scores as s(map_id, player_id, nickname, score, head_id, app_version)
    values (p_map, p_player, p_nick, p_score, p_head, left(p_ver, 20))
  on conflict (map_id, player_id) do update
    set score = greatest(s.score, excluded.score), nickname = excluded.nickname, head_id = excluded.head_id,
        app_version = excluded.app_version, updated_at = now()
  returning score into best;
  return best;
end $$;

-- 5) reads
create or replace view public.top_scores with (security_invoker = true) as
  select * from (
    select map_id, rank() over (partition by map_id order by score desc, updated_at) as rank, nickname, score, head_id, updated_at
    from public.scores) r
  where rank <= 50;

create or replace function public.get_top(p_map text, p_n integer default 10, p_player uuid default null)
returns table(rank bigint, nickname text, score integer, head_id text, is_me boolean)
language sql stable security definer set search_path = public as $$
  select rank() over (order by s.score desc, s.updated_at), s.nickname, s.score, s.head_id, (s.player_id = p_player)
  from scores s where s.map_id = p_map order by s.score desc, s.updated_at limit least(greatest(coalesce(p_n,10),1),50);
$$;

create or replace function public.my_rank(p_map text, p_player uuid)
returns table(rank bigint, score integer, total bigint)
language sql stable security definer set search_path = public as $$
  select (select count(*) from scores o where o.map_id = p_map and (o.score > s.score or (o.score = s.score and o.updated_at < s.updated_at))) + 1,
         s.score, (select count(*) from scores t where t.map_id = p_map)
  from scores s where s.map_id = p_map and s.player_id = p_player;
$$;

revoke all on function public.submit_score(text,uuid,text,integer,text,text) from public;
grant execute on function public.submit_score(text,uuid,text,integer,text,text) to anon, authenticated;
grant execute on function public.get_top(text,integer,uuid) to anon, authenticated;
grant execute on function public.my_rank(text,uuid) to anon, authenticated;
grant select on public.top_scores to anon, authenticated;

-- Moderation (run by you in the SQL editor): delete one player's entry
--   delete from public.scores where nickname = 'BadName';
