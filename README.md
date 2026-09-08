# King's Café Manager

Desktop-first cashier and barista web application.

## Architecture

Each feature owns four boundaries:

- `domain`: business entities and rules; no framework imports.
- `application`: use cases and repository ports.
- `infrastructure`: Supabase or in-memory implementations.
- `presentation`: React components and view models.

`src/app` is the Next.js composition and routing layer. `src/shared` contains only genuinely reusable primitives.

## Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
```

Supabase is intentionally not connected during the design phase. Infrastructure adapters can replace mock repositories without changing domain or presentation contracts.
