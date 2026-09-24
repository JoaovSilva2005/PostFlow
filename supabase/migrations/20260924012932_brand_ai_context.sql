begin;

alter table public.brands
  add column if not exists description text not null default '',
  add column if not exists target_audience text not null default '',
  add column if not exists products_or_services text not null default '',
  add column if not exists differentials text not null default '',
  add column if not exists content_goals text not null default '',
  add column if not exists keywords text not null default '',
  add column if not exists avoid_topics text not null default '',
  add column if not exists default_cta text not null default '';

commit;
