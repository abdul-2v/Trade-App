-- Allow authenticated traders to discover *public* active boost SKUs, but
-- never grant receipt, internal event, price override or catalog write access.
-- Store prices must come from Apple/Google, not this table.
grant select(provider,product_id,kind,boost_days)
 on public.tradarr_store_product_catalog to authenticated;
drop policy if exists tradarr_public_boost_skus on public.tradarr_store_product_catalog;
create policy tradarr_public_boost_skus
 on public.tradarr_store_product_catalog for select to authenticated
 using(
  enabled and kind='boost'
  and exists(
   select 1 from public.tradarr_billing_controls b
   where b.singleton and b.checkout_live and b.boosts_live and b.receipt_verifier_ready
  )
 );
