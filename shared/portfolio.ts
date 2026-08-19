import { z } from "zod";

export const portfolioTemplates = ["minimal", "gallery", "cards", "blog", "creative", "agency", "showcase"] as const;
export const portfolioColorSchemes = ["blue", "dark", "purple", "green", "warm"] as const;
export const portfolioFontFamilies = ["inter", "playfair", "georgia"] as const;
export const socialPlatforms = ["linkedin", "twitter", "instagram", "github", "behance"] as const;

export type PortfolioTemplate = (typeof portfolioTemplates)[number];
export type PortfolioColorScheme = (typeof portfolioColorSchemes)[number];
export type PortfolioFontFamily = (typeof portfolioFontFamilies)[number];
export type SocialPlatform = (typeof socialPlatforms)[number];

const portfolioImageUrl = z.string().max(1000).refine(
  (value) => value === "" || value.startsWith("/manus-storage/") || value.startsWith("https://") || value.startsWith("/"),
  "Некорректный URL изображения.",
);

export const socialLinkSchema = z.object({
  id: z.string().min(1).max(64),
  platform: z.enum(socialPlatforms),
  url: z.string().url().max(500),
});

export const projectSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500),
  images: z.array(portfolioImageUrl).min(1).max(6),
  tags: z.array(z.string().trim().min(1).max(32)).max(8),
  year: z.string().trim().min(1).max(12),
  href: z.string().url().max(500).optional(),
});

export const serviceSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300),
});

export const postSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().trim().min(2).max(160),
  excerpt: z.string().trim().max(500),
  date: z.string().trim().max(40),
  href: z.string().url().max(500).optional(),
});

export const portfolioInputSchema = z.object({
  title: z.string().trim().min(3, "Название должно содержать минимум 3 символа.").max(120),
  bio: z.string().trim().max(2000),
  logoUrl: portfolioImageUrl,
  avatarUrl: portfolioImageUrl,
  socialLinks: z.array(socialLinkSchema).max(5).superRefine((links, ctx) => {
    const duplicate = links.find((link, index) => links.findIndex((candidate) => candidate.platform === link.platform) !== index);
    if (duplicate) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Каждую социальную платформу можно добавить только один раз.", path: ["socialLinks"] });
  }),
  template: z.enum(portfolioTemplates),
  colorScheme: z.enum(portfolioColorSchemes),
  fontFamily: z.enum(portfolioFontFamilies),
  projects: z.array(projectSchema).max(16),
  services: z.array(serviceSchema).max(6),
  posts: z.array(postSchema).max(12),
  contactEmail: z.string().trim().email("Введите корректный email.").max(320).or(z.literal("")),
  slug: z.string().trim().max(50),
  slugManuallyEdited: z.boolean(),
  isPublished: z.boolean(),
});

export type PortfolioInput = z.infer<typeof portfolioInputSchema>;

export const defaultPortfolioInput: PortfolioInput = {
  title: "Untitled portfolio",
  bio: "",
  logoUrl: "",
  avatarUrl: "",
  socialLinks: [],
  template: "minimal",
  colorScheme: "blue",
  fontFamily: "inter",
  projects: [],
  services: [],
  posts: [],
  contactEmail: "",
  slug: "untitled-portfolio",
  slugManuallyEdited: false,
  isPublished: false,
};
