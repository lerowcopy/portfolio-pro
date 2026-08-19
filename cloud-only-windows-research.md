# Cloud-only Windows setup research

| Source | Verified browser-only finding |
|---|---|
| [GitHub Codespaces quickstart](https://docs.github.com/en/codespaces/getting-started/quickstart) | Codespaces provides browser VS Code, a cloud terminal, forwarded application ports and browser-based commit/publish to a private GitHub repository. No local Node, Git or editor is required. |
| [Vercel for GitHub](https://vercel.com/docs/git/vercel-for-github) | Every push deploys by default; pull requests receive unique preview URLs and the production branch updates the production domain. |
| [Supabase Vercel guide](https://supabase.com/partners/catalog/vercel) | A Vercel dashboard flow can create a GitHub repository from a Next.js template and connect a Supabase project through the Vercel Marketplace integration. Supabase SQL Editor supports browser-only schema setup. |

## Implication for Portfolio Pro

The browser-only workflow should use Vercel to create/import the GitHub repository, GitHub Codespaces for all commands and source edits, Supabase Dashboard SQL Editor for initial migrations, Vercel Dashboard for environment variables and deployments, Stripe Dashboard for products/webhooks, and Resend Dashboard for the API key/domain. Nothing needs to be installed on Windows.
