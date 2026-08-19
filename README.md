# Portfolio Pro

Portfolio Pro is a refined portfolio-builder application for creative professionals. It provides a Manus OAuth-protected workspace, a live visual editor, four presentation templates, S3-backed images, publication controls, and a public portfolio URL.

## Architecture

| Area | Implementation |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Wouter, Framer Motion |
| Server | Express 4 and tRPC 11 |
| Authentication | Built-in Manus OAuth with protected tRPC procedures |
| Database | Managed MySQL via Drizzle ORM |
| File storage | Managed S3 storage through `server/storage.ts` |
| State and validation | React Hook Form, Zod, TanStack Query |

## Local development

The managed project environment injects OAuth, database, and S3 credentials automatically. Do not commit `.env` files or hardcode service credentials.

```bash
pnpm install
pnpm dev
```

Open the URL printed by the development server. The login button starts the built-in Manus OAuth flow. OAuth must run in a browser that allows cookies.

## Database migration

The `portfolios` table is declared in `drizzle/schema.ts`. Generate a migration after changing the schema:

```bash
pnpm drizzle-kit generate
```

Review the generated SQL before applying it through the project database migration workflow.

## Verification commands

```bash
pnpm check
pnpm test
```

The current test suite verifies slug transliteration and sanitization, image signature validation, OAuth logout behavior, and that protected portfolio operations reject access without ownership.

## Product flows

After logging in, create a portfolio from the dashboard. The editor updates its right-side preview locally through React Hook Form state; typing and switching templates do not make network requests. Saving happens manually or every 30 seconds while the form is dirty. Logo and avatar uploads first show an object-URL preview, then replace it with a managed S3 URL after server validation.

Only a published portfolio is available at `/<slug>`. The server checks a direct single-segment request before the SPA fallback; unknown and unpublished slugs receive HTTP 404 with a noindex page.

## Security notes

Ownership is enforced on every protected portfolio procedure through `portfolio.id + session user.id` constraints. Client `userId` values are never accepted. The server validates every save with Zod, normalizes and deduplicates slugs, validates both MIME type and image file signature, and uses generated object keys rather than user-controlled filenames.
