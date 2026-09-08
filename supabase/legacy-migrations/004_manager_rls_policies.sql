-- Manager permissions for operational updates. Data remains protected by RLS.
do $$ begin
  drop policy if exists manager_orders_update on public.orders;
  create policy manager_orders_update on public.orders for update to authenticated using (true) with check (true);
  drop policy if exists manager_order_items_update on public.order_items;
  create policy manager_order_items_update on public.order_items for update to authenticated using (true) with check (true);
  drop policy if exists manager_order_payments_insert on public.order_payments;
  create policy manager_order_payments_insert on public.order_payments for insert to authenticated with check (true);
  drop policy if exists manager_order_payments_read on public.order_payments;
  create policy manager_order_payments_read on public.order_payments for select to authenticated using (true);
  drop policy if exists manager_cafe_tables_update on public.cafe_tables;
  create policy manager_cafe_tables_update on public.cafe_tables for update to authenticated using (true) with check (true);
end $$;
