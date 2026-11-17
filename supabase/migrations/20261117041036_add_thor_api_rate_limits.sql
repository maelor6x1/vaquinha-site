create table if not exists public.thor_api_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 1)
);

create index if not exists thor_api_rate_limits_window_idx
  on public.thor_api_rate_limits (window_started_at);

alter table public.thor_api_rate_limits enable row level security;
revoke all on table public.thor_api_rate_limits from public, anon, authenticated;

create or replace function public.thor_consume_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_count integer;
begin
  if p_bucket_key is null or length(p_bucket_key) <> 64
     or p_limit is null or p_limit < 1 or p_limit > 1000
     or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate limit parameters';
  end if;

  insert into public.thor_api_rate_limits as current_bucket
    (bucket_key, window_started_at, request_count)
  values
    (p_bucket_key, pg_catalog.now(), 1)
  on conflict (bucket_key) do update
    set window_started_at = case
          when current_bucket.window_started_at <= pg_catalog.now() - pg_catalog.make_interval(secs => p_window_seconds)
            then pg_catalog.now()
          else current_bucket.window_started_at
        end,
        request_count = case
          when current_bucket.window_started_at <= pg_catalog.now() - pg_catalog.make_interval(secs => p_window_seconds)
            then 1
          else current_bucket.request_count + 1
        end
  returning request_count into v_count;

  delete from public.thor_api_rate_limits
  where window_started_at < pg_catalog.now() - interval '2 days';

  return v_count <= p_limit;
end;
$function$;

revoke all on function public.thor_consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.thor_consume_rate_limit(text, integer, integer) to service_role;
