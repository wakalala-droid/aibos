-- 0011: Referral loop — who invited this business.
--
-- referred_by holds the referrer's code (first 8 chars of their user id),
-- stamped by the auth callback on FIRST profile provision only. Rewards are
-- applied manually by admin for now (find the referrer by id prefix); an
-- automated credit ledger comes later if the loop proves itself.

alter table public.profiles
  add column if not exists referred_by text;

create index if not exists profiles_referred_by_idx
  on public.profiles (referred_by)
  where referred_by is not null;
