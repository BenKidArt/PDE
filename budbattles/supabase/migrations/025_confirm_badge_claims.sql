-- =====================================================================
-- BudBattles update 025: an admin confirms every badge claim by @handle
-- Paste into Supabase → SQL Editor → New query → Run. Run once, after 024. Safe to run again.
--
-- Before: anyone who put an Instagram @handle in their profile got the badges saved on
-- that @handle (Founding Member for guest entries) right away – also someone else's @handle.
-- Now: a matching @handle only creates a CLAIM. It shows on the Admin page
-- ("Badge claims") and the badge is given only when an admin approves it.
-- =====================================================================

create table if not exists public.guest_badge_claims (
  id uuid primary key default gen_random_uuid(),
  handle text not null,                         -- lower case, without @
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (handle, user_id)
);
alter table public.guest_badge_claims enable row level security;
drop policy if exists "own or admin claims readable" on public.guest_badge_claims;
create policy "own or admin claims readable" on public.guest_badge_claims for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
grant select on public.guest_badge_claims to authenticated;

/** A member's @handle matches badges saved on that @handle: create a claim for an admin to check. */
create or replace function public.claim_guest_badges(p_user uuid, p_handle text) returns int
language plpgsql security definer set search_path = public as $$
declare h text := lower(trim(both '@ ' from coalesce(p_handle, ''))); n int := 0;
begin
  if p_user is null or h = '' then return 0; end if;
  if not exists (select 1 from public.guest_badges g where g.handle = h and g.claimed_by is null) then return 0; end if;
  insert into public.guest_badge_claims (handle, user_id) values (h, p_user)
  on conflict (handle, user_id) do nothing; -- one claim per person and @handle (a rejected one stays rejected)
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.claim_guest_badges(uuid, text) from public, anon, authenticated;

/** Admin: open claims with who claims which @handle, the badges and the entry photo. */
create or replace function public.admin_badge_claims() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  return coalesce((
    select json_agg(json_build_object(
      'id', c.id, 'handle', c.handle, 'status', c.status, 'created_at', c.created_at,
      'user_id', c.user_id, 'username', p.username, 'display_name', p.display_name, 'instagram', p.instagram,
      'badges', (select coalesce(json_agg(g.badge_id), '[]'::json) from public.guest_badges g where g.handle = c.handle and g.claimed_by is null),
      'photo_path', (select e.photo_path from public.guest_badges g join public.entries e on e.id = g.entry_id
                     where g.handle = c.handle order by g.created_at limit 1),
      'others', (select count(*) from public.guest_badge_claims o where o.handle = c.handle and o.id <> c.id and o.status = 'pending')
    ) order by c.created_at)
    from public.guest_badge_claims c
    left join public.profiles p on p.id = c.user_id
    where c.status = 'pending'), '[]'::json);
end $$;

/** Admin: approve (gives the badges, other claims for that @handle are rejected) or reject a claim. */
create or replace function public.admin_review_claim(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare c public.guest_badge_claims;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if p_status not in ('approved', 'rejected') then raise exception 'invalid status'; end if;
  select * into c from public.guest_badge_claims where id = p_id for update;
  if c.id is null or c.status <> 'pending' then raise exception 'claim not open'; end if;
  if p_status = 'approved' then
    insert into public.user_badges (user_id, badge_id, source, battle_id)
    select c.user_id, g.badge_id, 'auto', g.battle_id from public.guest_badges g
    where g.handle = c.handle and g.claimed_by is null
    on conflict do nothing;
    update public.guest_badges set claimed_by = c.user_id where handle = c.handle and claimed_by is null;
    update public.guest_badge_claims set status = 'rejected', reviewed_at = now()
    where handle = c.handle and id <> c.id and status = 'pending';
  end if;
  update public.guest_badge_claims set status = p_status, reviewed_at = now() where id = c.id;
end $$;

revoke execute on function public.admin_badge_claims(), public.admin_review_claim(uuid, text) from public, anon;
grant execute on function public.admin_badge_claims(), public.admin_review_claim(uuid, text) to authenticated;
