# Supabase adapter boundary

The application currently uses the in-memory manager data source. This folder is
the single integration boundary for Supabase; no page or feature should import a
Supabase SDK directly.

Required public environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

The adapter should be enabled only after the database schema and Row Level
Security policies are reviewed. Until then `manager-services.ts` continues to
compose the local data source, so the UI remains runnable without credentials.

## Shared customer/manager contract

Use `src/shared/domain/customer-manager-contract.ts` as the canonical shape in
both apps. Database adapters map Supabase snake_case rows to this camelCase
contract. Each order item stores its selected customizations as a snapshot, so
products may have any number of option groups, including none.

Apply migrations in order. Migration `002_customer_manager_compatibility.sql`
adds bilingual labels and dynamic order-item options.
