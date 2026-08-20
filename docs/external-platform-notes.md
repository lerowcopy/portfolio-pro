# External platform implementation notes

## Supabase Storage

The external runtime uses private buckets. Supabase Storage requires RLS policies on `storage.objects` for client operations; server-only secret keys bypass those policies and therefore the Railway adapter performs an explicit UUID ownership check before uploading, signing, or deleting an object. The bucket migration limits avatars and logos to 2 MiB, project images to 5 MiB, and allows only JPEG, PNG, and WebP.

## Vercel routing

Vercel supports rewrites to external origins. This project deliberately uses a same-origin **Vercel Function proxy** rather than a direct rewrite because the Railway origin stays in the server-only `RAILWAY_API_URL` setting. The filesystem API route `api/trpc/[...path].ts` is resolved before the final SPA fallback; browser calls therefore keep `/api/trpc` while Railway remains the external API origin. The fallback rule is only for non-filesystem client routes.

## References

[1]: https://supabase.com/docs/guides/storage/security/access-control "Supabase Storage Access Control"
[2]: https://supabase.com/docs/guides/storage/buckets/fundamentals "Supabase Storage Buckets"
[3]: https://vercel.com/docs/routing/rewrites "Vercel Rewrites"
