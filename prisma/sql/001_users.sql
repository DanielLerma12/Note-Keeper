-- Adds per-user accounts to Notekeeper (one-off, already applied to main-db).
--
-- 1. notekeeper.users mirrors hobbievault.users: the id is the Supabase auth
--    user, so signing in reuses the same email and password.
-- 2. notes and labels get a user_id; every note that existed before belongs to
--    daniellerma12 (danjeager12@gmail.com).
-- 3. The tester account gets the 5 min session / 24 h cooldown limit.
--
-- After this, `prisma db push` finds the schema already in sync.

begin;

create table if not exists notekeeper.users (
  -- Same id as auth.users. No foreign key to it: Prisma only manages the
  -- notekeeper schema and `db push` would drop a constraint into auth.
  id                     uuid primary key,
  username               text not null unique,
  email                  text not null unique,
  created_at             timestamptz(6) not null default now(),
  updated_at             timestamptz(6) not null default now(),
  auth_version           smallint not null default 0,
  session_limit_minutes  integer,
  session_cooldown_hours integer,
  last_sign_in_at        timestamptz(6)
);

alter table notekeeper.users enable row level security;

drop policy if exists users_select_own on notekeeper.users;
create policy users_select_own on notekeeper.users for select using (auth.uid() = id);

insert into notekeeper.users (id, username, email, session_limit_minutes, session_cooldown_hours)
select id, username, email,
       case when username = 'tester' then 5 end,
       case when username = 'tester' then 24 end
from hobbievault.users
where email in ('danjeager12@gmail.com', 'tester123@hobbyvault.com')
on conflict (id) do update
  set session_limit_minutes  = excluded.session_limit_minutes,
      session_cooldown_hours = excluded.session_cooldown_hours;

-- notes.user_id
alter table notekeeper.notes add column if not exists user_id uuid;
update notekeeper.notes
   set user_id = (select id from notekeeper.users where email = 'danjeager12@gmail.com')
 where user_id is null;
alter table notekeeper.notes alter column user_id set not null;
alter table notekeeper.notes drop constraint if exists notes_user_id_fkey;
alter table notekeeper.notes add constraint notes_user_id_fkey
  foreign key (user_id) references notekeeper.users (id) on delete cascade on update cascade;
drop index if exists notekeeper.notes_trashed_archived_idx;
create index if not exists notes_user_id_trashed_archived_idx on notekeeper.notes (user_id, trashed, archived);

-- labels.user_id: label names are unique per user, not globally
alter table notekeeper.labels add column if not exists user_id uuid;
update notekeeper.labels
   set user_id = (select id from notekeeper.users where email = 'danjeager12@gmail.com')
 where user_id is null;
alter table notekeeper.labels alter column user_id set not null;
alter table notekeeper.labels drop constraint if exists labels_user_id_fkey;
alter table notekeeper.labels add constraint labels_user_id_fkey
  foreign key (user_id) references notekeeper.users (id) on delete cascade on update cascade;
drop index if exists notekeeper.labels_name_key;
create unique index if not exists labels_user_id_name_key on notekeeper.labels (user_id, name);

commit;
