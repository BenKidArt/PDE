-- =====================================================================
-- BudBattles update 008: "Interested?" list on the Business page
-- Anyone can leave an email (+ optional company/club). Only admins can read
-- the list: Supabase → Table Editor → business_interest. Safe to run again.
-- =====================================================================

create table if not exists public.business_interest (
  id bigint generated always as identity primary key,
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  company text check (company is null or char_length(company) <= 120),
  lang text,
  created_at timestamptz not null default now()
);
create unique index if not exists business_interest_email on public.business_interest (lower(email));
alter table public.business_interest enable row level security;
drop policy if exists "admins read business interest" on public.business_interest;
create policy "admins read business interest" on public.business_interest for select
  using (public.is_admin());
grant select on public.business_interest to authenticated;

-- The form saves through this function (the same email twice just updates the name)
create or replace function public.register_business_interest(p_email text, p_company text, p_lang text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.business_interest (email, company, lang)
  values (lower(trim(p_email)), nullif(left(trim(coalesce(p_company, '')), 120), ''), left(p_lang, 5))
  on conflict (lower(email)) do update
    set company = coalesce(excluded.company, public.business_interest.company);
end $$;
revoke execute on function public.register_business_interest(text, text, text) from public;
grant execute on function public.register_business_interest(text, text, text) to anon, authenticated;
