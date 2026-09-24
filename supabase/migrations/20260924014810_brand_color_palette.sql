begin;

alter table public.brands
  add column if not exists color_palette jsonb not null default '["#4F46E5"]'::jsonb;

update public.brands
set color_palette = jsonb_build_array(primary_color)
where color_palette = '[]'::jsonb
   or jsonb_typeof(color_palette) <> 'array';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'brands_color_palette_check'
      and conrelid = 'public.brands'::regclass
  ) then
    alter table public.brands
      add constraint brands_color_palette_check check (
        jsonb_typeof(color_palette) = 'array'
        and jsonb_array_length(color_palette) between 1 and 5
      );
  end if;
end $$;

commit;
