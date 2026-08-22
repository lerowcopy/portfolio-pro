import React from "react";
import { ArrowUpRight, Github, Globe2, Instagram, Linkedin, Mail, Twitter } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import type { PreviewPortfolio } from "@/components/portfolio/PortfolioPreview";
import { useLanguage } from "@/contexts/LanguageContext";
import type { SocialPlatform } from "@shared/portfolio";
import { cn } from "@/lib/utils";

export type TemplatePortfolio = PreviewPortfolio;
export type TemplateProject = TemplatePortfolio["projects"][number];

const socialIcons: Record<SocialPlatform, typeof Globe2> = { linkedin: Linkedin, twitter: Twitter, instagram: Instagram, github: Github, behance: Globe2 };
const labels: Record<SocialPlatform, string> = { linkedin: "LinkedIn", twitter: "X / Twitter", instagram: "Instagram", github: "GitHub", behance: "Behance" };

export function OptimizedImage({ src, alt, className, priority = false }: { src: string; alt: string; className?: string; priority?: boolean }) {
  return <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} decoding="async" fetchPriority={priority ? "high" : "auto"} className={cn("object-cover", className)} />;
}

export function ProfileHero({ portfolio, compact = false, className }: { portfolio: TemplatePortfolio; compact?: boolean; className?: string }) {
  const initial = portfolio.title.trim().slice(0, 1).toUpperCase() || "P";
  const { t } = useLanguage();
  return <header className={cn("flex items-start justify-between gap-5", className)}><div className="flex min-w-0 items-center gap-4"><div className={cn("grid shrink-0 place-items-center overflow-hidden bg-[var(--p-soft)] font-bold text-[var(--p-accent)]", compact ? "size-12 rounded-2xl" : "size-20 rounded-[1.4rem] text-2xl")}>{portfolio.avatarUrl ? <OptimizedImage src={portfolio.avatarUrl} alt={t("public.portrait", { title: portfolio.title })} className="size-full" priority /> : initial}</div><div className="min-w-0"><h1 className={cn("text-balance font-semibold tracking-[-0.055em]", compact ? "text-2xl sm:text-3xl" : "text-4xl sm:text-5xl")}>{portfolio.title}</h1><p className={cn("mt-2 max-w-2xl whitespace-pre-line leading-7 text-[var(--p-muted)]", compact ? "text-sm" : "text-base sm:text-lg")}>{portfolio.bio}</p></div></div>{portfolio.logoUrl ? <OptimizedImage src={portfolio.logoUrl} alt={t("public.logo")} className="max-h-10 max-w-24" priority /> : null}</header>;
}

export function SocialNav({ portfolio }: { portfolio: TemplatePortfolio }) {
  const { t } = useLanguage();
  if (!portfolio.socialLinks.length) return null;
  return <nav aria-label={t("public.socialProfiles")} className="flex flex-wrap gap-2">{portfolio.socialLinks.map((link) => { const Icon = socialIcons[link.platform]; return <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-[var(--p-border)] bg-[var(--p-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--p-text)] transition-colors duration-200 hover:-translate-y-0.5 hover:bg-[var(--p-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)] focus-visible:ring-offset-2"><Icon className="size-3.5" />{labels[link.platform]}</a>; })}</nav>;
}

export function SectionHeading({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  const { t } = useLanguage();
  return <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--p-accent)]">{eyebrow || t("public.selectedWork")}</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.045em] sm:text-3xl">{title}</h2>{children}</div>;
}

export function ProjectMedia({ project, index, className }: { project: TemplateProject; index: number; className?: string }) {
  const { t } = useLanguage();
  const source = project.images[0];
  const gradients = ["from-violet-400 via-fuchsia-500 to-rose-500", "from-sky-300 via-blue-500 to-indigo-700", "from-amber-300 via-orange-500 to-rose-600", "from-emerald-300 via-teal-500 to-cyan-700"];
  if (!source) return <div aria-hidden="true" className={cn("bg-gradient-to-br", gradients[index % gradients.length], className)} />;
  return <OptimizedImage src={source} alt={t("public.projectPreview", { title: project.title })} className={className} />;
}

export function ProjectLink({ project, className }: { project: TemplateProject; className?: string }) {
  const { t } = useLanguage();
  if (!project.href) return null;
  return <a href={project.href} target="_blank" rel="noreferrer" className={cn("inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--p-accent)] transition-transform duration-200 hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]", className)}>{t("public.caseStudy")} <ArrowUpRight className="size-4" /></a>;
}

export function ProjectTags({ tags }: { tags: string[] }) { return <div className="flex flex-wrap gap-1.5">{tags.map((tag) => <span key={tag} className="rounded-full bg-[var(--p-soft)] px-2.5 py-1 text-xs font-medium text-[var(--p-muted)]">{tag}</span>)}</div>; }

export function ContactForm({ portfolio, title }: { portfolio: TemplatePortfolio; title?: string }) {
  const { t } = useLanguage();
  const email = portfolio.contactEmail || "hello@example.com";
  const submit = (event: FormEvent<HTMLFormElement>) => { event.currentTarget.action = `mailto:${email}`; };
  return <section aria-labelledby="contact-title" className="print:break-inside-avoid"><div className="rounded-[1.65rem] bg-[var(--p-soft)] p-6 sm:p-8 print:rounded-none print:border print:border-black/20 print:bg-white"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--p-accent)] print:text-black">{t("public.contact")}</p><h2 id="contact-title" className="mt-2 text-3xl font-semibold tracking-[-0.05em]">{title ?? t("public.contactTitle")}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[var(--p-muted)] print:text-black/70">{t("public.contactDescription")}</p><p className="mt-4 hidden text-sm font-semibold print:block">{t("public.email")}: {email}</p><form action={`mailto:${email}`} method="post" encType="text/plain" onSubmit={submit} className="mt-6 grid gap-3 sm:grid-cols-2 print:hidden"><div><label htmlFor="contact-name" className="sr-only">{t("public.yourName")}</label><input id="contact-name" name="name" required placeholder={t("public.yourName")} className="h-11 w-full rounded-xl border border-[var(--p-border)] bg-[var(--p-surface)] px-3 text-sm text-[var(--p-text)] placeholder:text-[var(--p-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]" /></div><div><label htmlFor="contact-email" className="sr-only">{t("public.yourEmail")}</label><input id="contact-email" name="email" type="email" required placeholder={t("public.yourEmail")} className="h-11 w-full rounded-xl border border-[var(--p-border)] bg-[var(--p-surface)] px-3 text-sm text-[var(--p-text)] placeholder:text-[var(--p-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]" /></div><div className="sm:col-span-2"><label htmlFor="contact-message" className="sr-only">{t("public.yourMessage")}</label><textarea id="contact-message" name="message" required rows={4} placeholder={t("public.projectHint")} className="w-full rounded-xl border border-[var(--p-border)] bg-[var(--p-surface)] px-3 py-3 text-sm text-[var(--p-text)] placeholder:text-[var(--p-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]" /></div><button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--p-accent)] px-5 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)] focus-visible:ring-offset-2 sm:justify-self-start"><Mail className="size-4" />{t("public.sendEmail")}</button></form></div></section>;
}

export function TemplateFooter({ portfolio }: { portfolio: TemplatePortfolio }) { return <footer className="flex flex-col justify-between gap-4 border-t border-[var(--p-border)] pt-6 text-sm text-[var(--p-muted)] sm:flex-row sm:items-center"><span>© {new Date().getFullYear()} {portfolio.title}</span><SocialNav portfolio={portfolio} /></footer>; }
