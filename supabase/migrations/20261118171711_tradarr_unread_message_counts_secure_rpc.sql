
create or replace function public.tradarr_unread_conversation_counts()
returns table(conversation_id uuid,unread_count bigint)
language sql stable security invoker set search_path = '' as $$
 select m.conversation_id,count(*)::bigint
 from public.messages m join public.conversations c on c.id=m.conversation_id
 where m.read_at is null and m.sender_id <> (select auth.uid())
  and ((select auth.uid())=c.customer_id or (select auth.uid())=c.tradesperson_id)
 group by m.conversation_id;
$$;
revoke all on function public.tradarr_unread_conversation_counts() from public,anon;
grant execute on function public.tradarr_unread_conversation_counts() to authenticated;

