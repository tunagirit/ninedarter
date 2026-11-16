-- ninedarter — Supabase schema (v1.0.1)
-- Supabase Dashboard → SQL Editor → New query → bu dosyanın tamamını yapıştırıp "Run".
-- Safe to run more than once.

-- ---------- Profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  avatar_url text,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[A-Za-z0-9_.]{3,20}$')
);
create unique index if not exists profiles_username_lower on public.profiles (lower(username));
alter table public.profiles enable row level security;

drop policy if exists "profiles readable by signed-in users" on public.profiles;
create policy "profiles readable by signed-in users" on public.profiles for select to authenticated using (true);
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Create the profile row automatically on sign-up (username comes from sign-up metadata)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'username', 'player_' || substr(new.id::text, 1, 8)));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Username availability check usable before sign-up (does not expose any profile data)
create or replace function public.username_available(u text) returns boolean
language sql security definer set search_path = public stable as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(u));
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- ---------- Friendships ----------
create table if not exists public.friendships (
  id bigint generated always as identity primary key,
  requester uuid not null references public.profiles (id) on delete cascade,
  addressee uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  constraint no_self_friend check (requester <> addressee)
);
create unique index if not exists friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));
alter table public.friendships enable row level security;

drop policy if exists "see own friendships" on public.friendships;
create policy "see own friendships" on public.friendships for select to authenticated using (auth.uid() in (requester, addressee));
drop policy if exists "send requests" on public.friendships;
create policy "send requests" on public.friendships for insert to authenticated with check (requester = auth.uid() and status = 'pending');
drop policy if exists "accept requests" on public.friendships;
create policy "accept requests" on public.friendships for update to authenticated using (addressee = auth.uid()) with check (addressee = auth.uid());
drop policy if exists "remove friendships" on public.friendships;
create policy "remove friendships" on public.friendships for delete to authenticated using (auth.uid() in (requester, addressee));

-- ---------- Matches ----------
create table if not exists public.matches (
  id text primary key,
  owner uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  participants uuid[] not null default '{}',
  type text not null,
  data jsonb not null,
  played_at timestamptz not null default now()
);
create index if not exists matches_participants on public.matches using gin (participants);
alter table public.matches enable row level security;

drop policy if exists "read matches I own or played" on public.matches;
create policy "read matches I own or played" on public.matches for select to authenticated using (owner = auth.uid() or auth.uid() = any (participants));
drop policy if exists "insert own matches" on public.matches;
create policy "insert own matches" on public.matches for insert to authenticated with check (owner = auth.uid());
drop policy if exists "update own matches" on public.matches;
create policy "update own matches" on public.matches for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists "delete own matches" on public.matches;
create policy "delete own matches" on public.matches for delete to authenticated using (owner = auth.uid());

-- ---------- Avatar storage ----------
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
drop policy if exists "avatar upload own folder" on storage.objects;
create policy "avatar upload own folder" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatar update own folder" on storage.objects;
create policy "avatar update own folder" on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatar delete own folder" on storage.objects;
create policy "avatar delete own folder" on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
