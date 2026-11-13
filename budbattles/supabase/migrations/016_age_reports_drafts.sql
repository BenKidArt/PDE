-- =====================================================================
-- BudBattles update 016:
--   1) Sign-up: date of birth, under-18s are refused
--   2) Accounts from before "Confirm email" was switched off count as confirmed
--   3) "Report" button for profiles and entries (underage / fake / spam), admin list
--   4) Hidden draft battles (admins only) + the draft "Sesh Setup" (pink style)
-- Paste into Supabase → SQL Editor → New query → Run. Safe to run again.
-- Battle #1, its entries and votes are not changed.
-- =====================================================================

do $$
begin
  if to_regclass('public.user_devices') is null then
    raise exception 'Please run update 010 (010_anticheat_and_profiles.sql) first, then this one.';
  end if;
end $$;

-- ---------- 1) Sign-up: date of birth ----------
-- The date of birth stays in the private account data (only the person and the
-- database see it). It is never copied to the public profile.
-- Under 18 (counted in German time) → the account is not created.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  wanted text := left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Grower'), 40);
  dob_txt text := nullif(trim(new.raw_user_meta_data ->> 'birth_date'), '');
  dob date;
begin
  if coalesce((new.raw_user_meta_data ->> 'age_confirmed')::boolean, false) is not true then
    raise exception 'age_confirmation_required';
  end if;
  if coalesce(new.raw_user_meta_data ->> 'terms_version', '') = '' then
    raise exception 'terms_acceptance_required';
  end if;
  -- the current app always sends a date of birth (older app versions did not)
  if dob_txt is not null then
    begin
      dob := dob_txt::date;
    exception when others then
      raise exception 'birth_date_invalid';
    end;
    if dob < date '1900-01-01' or dob > (now() at time zone 'Europe/Berlin')::date then
      raise exception 'birth_date_invalid';
    end if;
    if dob > ((now() at time zone 'Europe/Berlin')::date - interval '18 years')::date then
      raise exception 'underage';
    end if;
  end if;
  insert into public.profiles (id, display_name, age_confirmed_at, terms_accepted_at, terms_version,
                               username, username_changed_at)
  values (new.id, wanted, now(), now(), new.raw_user_meta_data ->> 'terms_version',
          case when public.profile_name_status(wanted, null) = 'ok' then wanted end,
          case when public.profile_name_status(wanted, null) = 'ok' then now() end);
  insert into public.user_badges (user_id, badge_id, source) values (new.id, 'badge_star', 'auto')
    on conflict do nothing;
  return new;
end $$;

-- ---------- 2) "Confirm email" is off now ----------
-- New accounts are confirmed automatically. Accounts that signed up before and never
-- clicked the link would otherwise be blocked from voting forever, so they count as
-- confirmed too. (The 24-hour rule and the bot check still apply to every vote.)
update auth.users set email_confirmed_at = now() where email_confirmed_at is null;

-- ---------- 3) Reports ----------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_user_id uuid not null references public.profiles (id) on delete cascade,
  entry_id uuid references public.entries (id) on delete cascade,
  reason text not null check (reason in ('underage', 'fake', 'spam')),
  note text check (char_length(note) <= 300),
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;   -- no policies: only through the functions below
-- the same person can report the same thing for the same reason only once
create unique index if not exists reports_once on public.reports
  (reporter_id, target_user_id, coalesce(entry_id, '00000000-0000-0000-0000-000000000000'::uuid), reason);

create or replace function public.report_content(p_user uuid, p_entry uuid, p_reason text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  target uuid := p_user;
begin
  if me is null then raise exception 'login_required'; end if;
  if p_reason is null or p_reason not in ('underage', 'fake', 'spam') then raise exception 'invalid_reason'; end if;
  if p_entry is not null then
    select e.user_id into target from public.entries e where e.id = p_entry;
    if not found then raise exception 'invalid_entry'; end if;
  end if;
  if target is null or not exists (select 1 from public.profiles where id = target) then
    raise exception 'invalid_user';
  end if;
  if target = me then raise exception 'cannot_report_self'; end if;
  if (select count(*) from public.reports where reporter_id = me and created_at > now() - interval '1 day') >= 20 then
    raise exception 'rate_limited';
  end if;
  insert into public.reports (reporter_id, target_user_id, entry_id, reason, note)
  values (me, target, p_entry, p_reason, nullif(left(trim(coalesce(p_note, '')), 300), ''))
  on conflict do nothing;
end $$;
revoke execute on function public.report_content(uuid, uuid, text, text) from public;
grant execute on function public.report_content(uuid, uuid, text, text) to authenticated;

-- Admin list: newest first, with names and the reported photo
create or replace function public.admin_reports()
returns json language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  return coalesce((
    select json_agg(json_build_object(
      'id', r.id, 'reason', r.reason, 'note', r.note, 'status', r.status, 'created_at', r.created_at,
      'reporter', coalesce(rp.username, rp.display_name),
      'target_id', r.target_user_id, 'target', coalesce(tp.username, tp.display_name),
      'entry_id', r.entry_id, 'photo_path', e.photo_path, 'battle_id', e.battle_id,
      'target_open', (select count(*) from public.reports x where x.target_user_id = r.target_user_id and x.status = 'open'))
      order by (r.status = 'open') desc, r.created_at desc)
    from public.reports r
    join public.profiles rp on rp.id = r.reporter_id
    join public.profiles tp on tp.id = r.target_user_id
    left join public.entries e on e.id = r.entry_id), '[]'::json);
end $$;
revoke execute on function public.admin_reports() from public;
grant execute on function public.admin_reports() to authenticated;

create or replace function public.admin_set_report(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not_admin'; end if;
  if p_status not in ('open', 'done') then raise exception 'invalid_status'; end if;
  update public.reports set status = p_status where id = p_id;
end $$;
revoke execute on function public.admin_set_report(uuid, text) from public;
grant execute on function public.admin_set_report(uuid, text) to authenticated;

-- ---------- 4) Hidden draft battles ----------
alter table public.battles add column if not exists is_draft boolean not null default false;  -- only admins see it
alter table public.battles add column if not exists style text not null default '';           -- '' = green, 'pink'
alter table public.battles add column if not exists subtitle_de text not null default '';
alter table public.battles add column if not exists subtitle_en text not null default '';
alter table public.battles add column if not exists partner_kind text not null default 'partner';  -- 'partner' or 'host'
alter table public.battles drop constraint if exists battles_style_check;
alter table public.battles add constraint battles_style_check check (style in ('', 'pink'));
alter table public.battles drop constraint if exists battles_partner_kind_check;
alter table public.battles add constraint battles_partner_kind_check check (partner_kind in ('partner', 'host'));

drop policy if exists "battles readable" on public.battles;
create policy "battles readable" on public.battles for select
  using ((not is_test or public.can_test()) and (not is_draft or public.is_admin()));

-- The draft "Sesh Setup". Dates are placeholders (change them before it goes live).
-- To publish it later: update public.battles set is_draft = false where id = 'draft-sesh-setup';
insert into public.battles (id, number, theme_de, theme_en, summary_de, summary_en, subtitle_de, subtitle_en,
                            partner_name, partner_kind, rules_de, rules_en,
                            start_at, entries_close_at, voting_ends_at, is_draft, style)
values ('draft-sesh-setup', null, 'Sesh Setup', 'Sesh Setup',
  'Das schönste Sesh-Setup: Tisch, Glas, Kerzen, Snacks und Deko. Buds sind nicht nötig.',
  'The most beautiful sesh setup: table, glass, candles, snacks and decoration. No buds required.',
  'Hosted with 420 Girls Sesh', 'Hosted with 420 Girls Sesh',
  '420 Girls Sesh', 'host',
  E'Teilnahme ab 18 Jahren.\nEin Foto pro Person.\nGesichter sind freiwillig.\nKeine Verkäufe, keine Preise und kein Konsum auf dem Foto.',
  E'18+ only.\nOne photo per person.\nFaces are optional.\nNo sales, no prices and no consumption shown in the photo.',
  timestamptz '2027-02-01 00:00 Europe/Berlin', timestamptz '2027-02-07 23:59 Europe/Berlin',
  timestamptz '2027-02-14 23:59 Europe/Berlin', true, 'pink')
on conflict (id) do nothing;
