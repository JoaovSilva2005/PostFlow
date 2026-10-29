begin;

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null,
  provider_request_id text,
  user_id uuid not null,
  user_email text not null,
  user_display_name text not null,
  workspace_id uuid,
  operation text not null check (
    operation in ('text_generation', 'image_generation')
  ),
  model text not null,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  cached_input_tokens integer not null default 0 check (cached_input_tokens >= 0),
  cache_write_input_tokens integer not null default 0 check (cache_write_input_tokens >= 0),
  text_input_tokens integer not null default 0 check (text_input_tokens >= 0),
  image_input_tokens integer not null default 0 check (image_input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  text_output_tokens integer not null default 0 check (text_output_tokens >= 0),
  image_output_tokens integer not null default 0 check (image_output_tokens >= 0),
  reasoning_tokens integer not null default 0 check (reasoning_tokens >= 0),
  usage_accuracy text not null check (
    usage_accuracy in ('reported', 'estimated', 'missing')
  ),
  cost_accuracy text not null check (
    cost_accuracy in ('calculated', 'estimated', 'unpriced')
  ),
  image_quality text,
  image_size text,
  draft_count integer not null default 0 check (draft_count >= 0),
  cost_usd numeric(20, 12) check (cost_usd is null or cost_usd >= 0),
  usd_brl_rate numeric(14, 8) check (usd_brl_rate is null or usd_brl_rate > 0),
  cost_brl numeric(20, 10) check (cost_brl is null or cost_brl >= 0),
  exchange_rate_source text,
  rate_snapshot jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_user_period_idx
  on public.ai_usage_events (user_id, occurred_at desc);
create index if not exists ai_usage_events_period_idx
  on public.ai_usage_events (occurred_at);
create index if not exists ai_usage_events_generation_idx
  on public.ai_usage_events (generation_id);
create index if not exists ai_usage_events_model_period_idx
  on public.ai_usage_events (model, occurred_at desc);

alter table public.ai_usage_events enable row level security;
revoke all on table public.ai_usage_events from public, anon, authenticated;
grant insert, select on table public.ai_usage_events to service_role;

create or replace function public.get_ai_usage_monthly_report(
  p_month date
) returns table (
  user_id uuid,
  user_email text,
  user_display_name text,
  calls bigint,
  text_calls bigint,
  image_calls bigint,
  generations bigint,
  posts_generated bigint,
  input_tokens bigint,
  cached_input_tokens bigint,
  output_tokens bigint,
  image_output_tokens bigint,
  total_cost_usd numeric,
  total_cost_brl numeric,
  estimated_calls bigint,
  unpriced_calls bigint,
  missing_exchange_rate_calls bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with period_events as (
    select event.*
      from public.ai_usage_events as event
     where event.occurred_at >= (p_month::timestamp at time zone 'UTC')
       and event.occurred_at < (
         (p_month + interval '1 month')::timestamp at time zone 'UTC'
       )
  ), generation_totals as (
    select event.user_id,
           event.generation_id,
           max(event.draft_count)::bigint as draft_count,
           bool_or(event.operation = 'text_generation') as has_text_call
      from period_events as event
     group by event.user_id, event.generation_id
  ), user_post_totals as (
    select generation.user_id,
           count(*) filter (where generation.has_text_call)::bigint as generations,
           coalesce(sum(generation.draft_count), 0)::bigint as posts_generated
      from generation_totals as generation
     group by generation.user_id
  )
  select event.user_id,
         (array_agg(event.user_email order by event.occurred_at desc))[1],
         (array_agg(event.user_display_name order by event.occurred_at desc))[1],
         count(*)::bigint,
         count(*) filter (where event.operation = 'text_generation')::bigint,
         count(*) filter (where event.operation = 'image_generation')::bigint,
         coalesce(post_totals.generations, 0),
         coalesce(post_totals.posts_generated, 0),
         coalesce(sum(event.input_tokens), 0)::bigint,
         coalesce(sum(event.cached_input_tokens), 0)::bigint,
         coalesce(sum(event.output_tokens), 0)::bigint,
         coalesce(sum(event.image_output_tokens), 0)::bigint,
         coalesce(sum(event.cost_usd), 0)::numeric,
         coalesce(sum(event.cost_brl), 0)::numeric,
         count(*) filter (
           where event.usage_accuracy = 'estimated'
              or event.cost_accuracy = 'estimated'
         )::bigint,
         count(*) filter (where event.cost_accuracy = 'unpriced')::bigint,
         count(*) filter (
           where event.cost_usd is not null and event.cost_brl is null
         )::bigint
    from period_events as event
    left join user_post_totals as post_totals
      on post_totals.user_id = event.user_id
   group by event.user_id,
            post_totals.generations,
            post_totals.posts_generated
   order by coalesce(sum(event.cost_brl), 0) desc,
            coalesce(sum(event.cost_usd), 0) desc;
$$;

revoke all on function public.get_ai_usage_monthly_report(date)
  from public, anon, authenticated;
grant execute on function public.get_ai_usage_monthly_report(date)
  to service_role;

commit;
