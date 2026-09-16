-- Keep account state undiscoverable to anonymous clients while allowing
-- authenticated owner sessions to reach the RLS-protected tables.
revoke all on table public.liv8_user_state from anon;
revoke all on table public.liv8_affiliate_imports from anon;

grant select, insert, update, delete on table public.liv8_user_state to authenticated;
grant select, insert, delete on table public.liv8_affiliate_imports to authenticated;
