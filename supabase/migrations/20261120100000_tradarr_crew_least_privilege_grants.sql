-- Supabase creates SQL tables with broad initial anon/authenticated privileges.
-- RLS is retained, but permissions must also be least-privilege.
revoke all on table
 public.crew_profiles,
 public.crew_requests,
 public.crew_applications,
 public.crew_saved,
 public.crew_messages
from public,anon,authenticated;

grant select,insert on public.crew_profiles to authenticated;
grant update (
 display_name,headline,trade,level,area_label,experience_years,
 about,availability_note,is_visible,adult_confirmed,updated_at
) on public.crew_profiles to authenticated;

grant select,insert on public.crew_requests to authenticated;
grant update(status) on public.crew_requests to authenticated;

grant select,insert on public.crew_applications to authenticated;
-- Status changes go solely through validated crew_set_application_status().
grant select,insert,delete on public.crew_saved to authenticated;
grant select,insert on public.crew_messages to authenticated;

-- These tables remain fully available to the trusted service_role.
