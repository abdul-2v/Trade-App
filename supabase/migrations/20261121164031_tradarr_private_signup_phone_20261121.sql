-- Keep an account phone private until a trader explicitly publishes a business number.
-- Existing public contact choices are unchanged.
CREATE OR REPLACE FUNCTION private.handle_new_tradehub_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_account_type text;
 v_first_name text;
 v_last_name text;
 v_phone text;
 v_primary_trade text;
begin
 v_account_type := case
  when new.raw_user_meta_data->>'account_type'='tradesperson' then 'tradesperson'
  when new.raw_user_meta_data->>'account_type'='crew' then 'crew'
  else 'customer' end;
 v_first_name := coalesce(new.raw_user_meta_data->>'first_name','');
 v_last_name := coalesce(new.raw_user_meta_data->>'last_name','');
 v_phone := nullif(new.raw_user_meta_data->>'phone','');
 v_primary_trade := nullif(new.raw_user_meta_data->>'primary_trade','');
 insert into public.profiles(id,account_type,first_name,last_name,phone)
 values(new.id,v_account_type,v_first_name,v_last_name,v_phone);
 if v_account_type='tradesperson' then
  insert into public.tradesperson_profiles(user_id,display_name,primary_trade,public_phone)
  values(new.id,trim(v_first_name||' '||v_last_name),v_primary_trade,null);
  insert into public.trade_availability(user_id) values(new.id);
 end if;
 return new;
end;
$function$

