import type { PortfolioInput, ProjectInput } from "../../shared/portfolio";
import { uuidSchema } from "./ownership";

export function createPortfolioQuery(userId: string, title: string, slug: string, email: string | null) {
  return {
    text: "insert into public.portfolios (user_id, title, bio, slug, social_links, template, color_scheme, font_family, is_published, contact_email) values ($1::uuid, $2, '', $3, '[]'::jsonb, 'minimal', 'blue', 'inter', false, $4) returning *",
    values: [uuidSchema.parse(userId), title, slug, email],
  } as const;
}

export function updatePortfolioQuery(portfolioId: string, userId: string, values: PortfolioInput, slug: string) {
  return {
    text: "update public.portfolios set title = $3, bio = $4, logo_path = $5, avatar_path = $6, social_links = $7::jsonb, template = $8, color_scheme = $9, font_family = $10, services = $11::jsonb, posts = $12::jsonb, contact_email = $13, is_published = $14::boolean, published_at = case when $14::boolean and published_at is null then timezone('utc', now()) else published_at end, slug = $15, slug_manually_edited = $16::boolean where id = $1::uuid and user_id = $2::uuid returning *",
    values: [
      uuidSchema.parse(portfolioId),
      uuidSchema.parse(userId),
      values.title,
      values.bio,
      values.logoUrl || null,
      values.avatarUrl || null,
      JSON.stringify(values.socialLinks),
      values.template,
      values.colorScheme,
      values.fontFamily,
      JSON.stringify(values.services),
      JSON.stringify(values.posts),
      values.contactEmail || null,
      values.isPublished,
      slug,
      values.slugManuallyEdited,
    ],
  } as const;
}

export function deletePortfolioQuery(portfolioId: string, userId: string) {
  return {
    text: "delete from public.portfolios where id = $1::uuid and user_id = $2::uuid returning id",
    values: [uuidSchema.parse(portfolioId), uuidSchema.parse(userId)],
  } as const;
}

export function createProjectQuery(portfolioId: string, userId: string, values: ProjectInput) {
  return {
    text: "insert into public.portfolio_projects (portfolio_id, title, description, image_paths, tags, project_url, start_date, end_date, sort_order) select f.id, $3, $4, $5::text[], $6::text[], $7, $8::date, $9::date, coalesce((select max(p.sort_order) + 1 from public.portfolio_projects p where p.portfolio_id = f.id), 0) from public.portfolios f where f.id = $1::uuid and f.user_id = $2::uuid returning *",
    values: [
      uuidSchema.parse(portfolioId),
      uuidSchema.parse(userId),
      values.title,
      values.description,
      values.images,
      values.tags,
      values.projectUrl || null,
      values.startDate || null,
      values.endDate || null,
    ],
  } as const;
}

export function updateProjectQuery(projectId: string, portfolioId: string, userId: string, values: ProjectInput) {
  return {
    text: "update public.portfolio_projects p set title = $4, description = $5, image_paths = $6::text[], tags = $7::text[], project_url = $8, start_date = $9::date, end_date = $10::date from public.portfolios f where p.id = $1::uuid and p.portfolio_id = $2::uuid and f.id = p.portfolio_id and f.user_id = $3::uuid returning p.*",
    values: [
      uuidSchema.parse(projectId),
      uuidSchema.parse(portfolioId),
      uuidSchema.parse(userId),
      values.title,
      values.description,
      values.images,
      values.tags,
      values.projectUrl || null,
      values.startDate || null,
      values.endDate || null,
    ],
  } as const;
}

export function deleteProjectQuery(projectId: string, portfolioId: string, userId: string) {
  return {
    text: "delete from public.portfolio_projects p using public.portfolios f where p.id = $1::uuid and p.portfolio_id = $2::uuid and f.id = p.portfolio_id and f.user_id = $3::uuid returning p.id",
    values: [uuidSchema.parse(projectId), uuidSchema.parse(portfolioId), uuidSchema.parse(userId)],
  } as const;
}
