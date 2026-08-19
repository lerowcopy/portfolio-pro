import { z } from "zod";

export const portfolioTemplates = ["minimal", "gallery", "cards", "blog"] as const;
export const portfolioColorSchemes = ["blue", "dark", "purple", "green"] as const;
export const portfolioFontFamilies = ["inter", "playfair", "georgia"] as const;
export const socialPlatforms = ["linkedin", "twitter", "instagram", "github", "behance"] as const;

export type PortfolioTemplate = (typeof portfolioTemplates)[number];
export type PortfolioColorScheme = (typeof portfolioColorSchemes)[number];
export type PortfolioFontFamily = (typeof portfolioFontFamilies)[number];
export type SocialPlatform = (typeof socialPlatforms)[number];

export const socialLinkSchema = z.object({
  id: z.string().min(1).max(64),
  platform: z.enum(socialPlatforms),
  url: z.string().url().max(500),
});

export const portfolioInputSchema = z.object({
  title: z.string().trim().min(3, "Название должно содержать минимум 3 символа.").max(120),
  bio: z.string().trim().max(2000),
  logoUrl: z.string().max(1000).refine((value) => value === "" || value.startsWith("/manus-storage/"), "Некорректный URL логотипа."),
  avatarUrl: z.string().max(1000).refine((value) => value === "" || value.startsWith("/manus-storage/"), "Некорректный URL аватара."),
  socialLinks: z.array(socialLinkSchema).max(5).superRefine((links, ctx) => {
    const duplicate = links.find((link, index) => links.findIndex((candidate) => candidate.platform === link.platform) !== index);
    if (duplicate) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Каждую социальную платформу можно добавить только один раз.", path: ["socialLinks"] });
    }
  }),
  template: z.enum(portfolioTemplates),
  colorScheme: z.enum(portfolioColorSchemes),
  fontFamily: z.enum(portfolioFontFamilies),
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
  slug: "untitled-portfolio",
  slugManuallyEdited: false,
  isPublished: false,
};
