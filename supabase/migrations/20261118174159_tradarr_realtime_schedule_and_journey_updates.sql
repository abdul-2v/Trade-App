-- Enable the same low-latency updates already used by conversations/jobs.
alter publication supabase_realtime add table public.trade_appointment_changes;
alter publication supabase_realtime add table public.trade_appointments;
alter publication supabase_realtime add table public.trade_route_plans;
alter publication supabase_realtime add table public.trade_grid_slots;

