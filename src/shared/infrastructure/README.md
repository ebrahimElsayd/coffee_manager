# Data boundary

Pages and components should depend on `ManagerDataSource`, not on Supabase, SQL, or fetch details.

The production composition is `manager-services.ts`, which uses the Supabase adapter.
The UI contracts, status workflow, and routes remain unchanged. Test fixtures must stay
outside `src` so mock records can never appear in the running application.

## Canonical record shape

`ManagerOrder` is the application boundary for an order. Each record carries the
order id, table/session identity, customer, optional `openedAt`/`closedAt`,
cashier identity, workflow status, payment status, and its `ManagerDrink[]`.
Each drink keeps its product id (when available), quantity, unit price, options,
note, and preparation status. `ProductCustomization` represents a product option
group and its priced choices; an empty choices array means the product has no
customization for that group.

The Supabase adapter should map database rows into these records at the boundary.
Components must not read database rows directly.
