# External Platform Research Notes

## Official sources reviewed

| Source | Key findings used for Portfolio Pro blueprint |
|---|---|
| [Vercel Stripe & Supabase SaaS Starter](https://vercel.com/templates/next.js/stripe-supabase-saas-starter-kit) | Validates the Next.js + Supabase Auth/Postgres + Stripe Checkout/Customer Portal shape, and documents local Stripe CLI forwarding. |
| [Vercel nextjs-subscription-payments](https://github.com/vercel/nextjs-subscription-payments) | Notes that the repository is sunset in favour of Next.js SaaS Starter, but its deployment order remains useful: configure Supabase Auth redirect URLs, Stripe webhook secret, products/prices and customer portal. |
| [Supabase SSR for Next.js](https://supabase.com/docs/guides/auth/server-side/nextjs) | Recommends `@supabase/ssr`, request-scoped server clients, a browser client, and `getClaims()` for server-side authorization instead of trusting `getSession()`. |

## Architecture implications

The recommended external implementation uses Next.js App Router on Vercel, Supabase Auth/Postgres/Storage, and Stripe Billing. The service-role key stays server-only. Supabase’s public publishable key can be exposed through `NEXT_PUBLIC_` environment variables. Checkout and customer portal must be server-created; Stripe webhooks remain the source of truth for paid entitlements.

For local development, use the Supabase CLI or a dedicated development Supabase project, Vercel env pull, and Stripe CLI webhook forwarding. Use separate production and preview/staging environments once user data exists.
