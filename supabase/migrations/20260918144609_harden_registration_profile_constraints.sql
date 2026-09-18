-- Alinha as restrições persistentes aos limites do cadastro e do onboarding.
begin;

alter table public.users
  drop constraint if exists users_display_name_length_check;
alter table public.users
  add constraint users_display_name_length_check
  check (length(trim(display_name)) between 2 and 80);

alter table public.profiles
  drop constraint if exists profiles_display_name_length_check;
alter table public.profiles
  add constraint profiles_display_name_length_check
  check (length(trim(display_name)) between 2 and 80);

alter table public.brands
  drop constraint if exists brands_name_length_check;
alter table public.brands
  add constraint brands_name_length_check
  check (length(trim(name)) between 2 and 120);

alter table public.brands
  drop constraint if exists brands_segment_length_check;
alter table public.brands
  add constraint brands_segment_length_check
  check (length(trim(segment)) between 2 and 80);

commit;
