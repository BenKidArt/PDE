-- =====================================================================
-- BudBattles update 033: rejected / deleted entries free the @handle
-- Paste into Supabase → SQL Editor → New query → Run. Run once, after 032. Safe to run again.
--   • "One entry per @handle per battle" now ignores REJECTED entries, so a grower can be added again
--     (deleting an entry on the Admin page frees the handle as well)
--   • admin_add_entry: same rule
-- =====================================================================

drop index if exists public.entries_guest_once;
create unique index if not exists entries_guest_once_active on public.entries (battle_id, lower(guest_handle))
  where guest_handle is not null and status <> 'rejected';

create or replace function public.admin_add_entry(p_battle text, p_handle text, p_strain text, p_breeder text,
  p_photo_path text, p_width int, p_height int) returns uuid
language plpgsql security definer set search_path = public as $$
declare h text := lower(trim(both '@ ' from coalesce(p_handle, ''))); new_id uuid;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if h !~ '^[a-z0-9._]{1,30}$' then raise exception 'invalid instagram handle'; end if;
  if not exists (select 1 from public.battles where id = p_battle and voting_ends_at > now()) then raise exception 'battle is over'; end if;
  if exists (select 1 from public.entries where battle_id = p_battle and lower(guest_handle) = h and status <> 'rejected') then
    raise exception 'already entered';
  end if;
  insert into public.entries (battle_id, user_id, guest_handle, added_by, photo_path, width, height, strain, breeder, description, status, reviewed_at)
  values (p_battle, null, h, auth.uid(), p_photo_path, p_width, p_height,
          nullif(trim(coalesce(p_strain, '')), ''), nullif(trim(coalesce(p_breeder, '')), ''), '', 'approved', now())
  returning id into new_id;
  return new_id;
end $$;
revoke execute on function public.admin_add_entry(text, text, text, text, text, int, int) from public, anon;
grant execute on function public.admin_add_entry(text, text, text, text, text, int, int) to authenticated;
