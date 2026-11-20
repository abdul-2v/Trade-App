-- The mobile paywall must only sell store products approved in our
-- private catalog, never unreviewed RevenueCat offering entries.
-- The rows expose no receipts, keys, account IDs or prices.
drop policy if exists tradarr_public_boost_skus on public.tradarr_store_product_catalog;
drop policy if exists tradarr_public_approved_store_skus on public.tradarr_store_product_catalog;
create policy tradarr_public_approved_store_skus
 on public.tradarr_store_product_catalog for select to authenticated
 using (
   enabled and exists (
    select 1 from public.tradarr_billing_controls b
    where b.singleton and b.checkout_live and b.receipt_verifier_ready
      and (kind='subscription' or (kind='boost' and b.boosts_live))
   )
 );
