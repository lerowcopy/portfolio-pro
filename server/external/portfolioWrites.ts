import { uuidSchema } from "./ownership";

export function createPortfolioQuery(userId: string, title: string, slug: string, email: string | null) {
  return {
    text: "insert into public.portfolios (user_id, title, bio, slug, social_links, template, color_scheme, font_family, is_published, contact_email) values ($1::uuid, $2, '', $3, '[]'::jsonb, 'minimal', 'blue', 'inter', false, $4) returning *",
    values: [uuidSchema.parse(userId), title, slug, email],
  } as const;
}
