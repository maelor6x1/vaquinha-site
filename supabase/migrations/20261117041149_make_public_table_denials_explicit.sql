create policy thor_doacoes_deny_public
  on public.doacoes
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy thor_rate_limits_deny_public
  on public.thor_api_rate_limits
  for all
  to anon, authenticated
  using (false)
  with check (false);
