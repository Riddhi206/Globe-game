-- 010_rooms_keys.sql — repair for databases where the room tables were created
-- without their primary keys (for example by an earlier draft of 009_rooms.sql;
-- "create table if not exists" never adds a key to a table that already exists).
-- Without them, "on conflict do nothing" stops working and a player who opens a
-- game night twice is listed twice. Removes duplicate rows, then adds each
-- missing key. Safe to re-run.

do $$
declare
  t record;
begin
  for t in select * from (values
      ('room_members',  'room_id, user_id'),
      ('night_players', 'night_id, user_id'),
      ('night_rounds',  'night_id, round'),
      ('night_results', 'night_id, round, user_id')
    ) as v(tbl, cols)
  loop
    if not exists (select 1 from pg_constraint
                   where conrelid = format('public.%I', t.tbl)::regclass and contype = 'p') then
      -- Keep the first copy of each row, drop the rest
      execute format(
        'delete from public.%I a using public.%I b where (%s) = (%s) and a.ctid > b.ctid',
        t.tbl, t.tbl,
        (select string_agg('a.' || trim(c), ', ') from unnest(string_to_array(t.cols, ',')) c),
        (select string_agg('b.' || trim(c), ', ') from unnest(string_to_array(t.cols, ',')) c));
      execute format('alter table public.%I add primary key (%s)', t.tbl, t.cols);
      raise notice 'added primary key to %', t.tbl;
    end if;
  end loop;
end $$;
