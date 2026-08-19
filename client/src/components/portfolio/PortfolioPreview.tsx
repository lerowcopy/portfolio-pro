import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Github, Globe2, Instagram, Linkedin, Newspaper, Twitter } from "lucide-react";
import type { CSSProperties } from "react";
import type { PortfolioColorScheme, PortfolioFontFamily, PortfolioInput, PortfolioTemplate, SocialPlatform } from "@shared/portfolio";
import { cn } from "@/lib/utils";

export type PreviewPortfolio = Pick<PortfolioInput, "title" | "bio" | "logoUrl" | "avatarUrl" | "socialLinks" | "template" | "colorScheme" | "fontFamily">;

const colors: Record<PortfolioColorScheme, Record<string, string>> = {
  blue: { "--p-bg": "#f2f7ff", "--p-surface": "#ffffff", "--p-text": "#10213f", "--p-muted": "#55709c", "--p-accent": "#2764d8", "--p-soft": "#dbeafe", "--p-border": "#cbdcf8" },
  dark: { "--p-bg": "#101218", "--p-surface": "#191c25", "--p-text": "#f7f7fa", "--p-muted": "#aeb5c7", "--p-accent": "#a78bfa", "--p-soft": "#2a2445", "--p-border": "#323746" },
  purple: { "--p-bg": "#f8f4ff", "--p-surface": "#ffffff", "--p-text": "#27144b", "--p-muted": "#7658aa", "--p-accent": "#7544d7", "--p-soft": "#ede5ff", "--p-border": "#dfd1ff" },
  green: { "--p-bg": "#f0faf5", "--p-surface": "#ffffff", "--p-text": "#0c3524", "--p-muted": "#4b8065", "--p-accent": "#0f8b55", "--p-soft": "#d8f4e5", "--p-border": "#bee8d1" },
};
const fonts: Record<PortfolioFontFamily, string> = { inter: '"DM Sans", system-ui, sans-serif', playfair: '"DM Serif Display", Georgia, serif', georgia: "Georgia, serif" };
const socialIcons: Record<SocialPlatform, typeof Globe2> = { linkedin: Linkedin, twitter: Twitter, instagram: Instagram, github: Github, behance: Globe2 };
const projectGradients = ["from-indigo-400 via-violet-500 to-fuchsia-500", "from-sky-300 via-cyan-500 to-blue-600", "from-amber-300 via-rose-400 to-red-500", "from-emerald-300 via-teal-500 to-cyan-600"];

function Identity({ portfolio, compact = false }: { portfolio: PreviewPortfolio; compact?: boolean }) {
  const initial = portfolio.title.trim().slice(0, 1).toUpperCase() || "P";
  return <div className={cn("flex items-start justify-between gap-4", compact && "items-center")}><div className="flex min-w-0 items-center gap-3"><div className={cn("grid shrink-0 place-items-center overflow-hidden bg-[var(--p-soft)] font-semibold text-[var(--p-accent)]", compact ? "size-10 rounded-xl text-sm" : "size-16 rounded-2xl text-xl")}>{portfolio.avatarUrl ? <img className="size-full object-cover" src={portfolio.avatarUrl} alt="Profile portrait" /> : initial}</div><div className="min-w-0"><h1 className={cn("truncate font-semibold tracking-[-0.045em]", compact ? "text-lg" : "text-3xl sm:text-4xl")}>{portfolio.title || "Your name"}</h1>{compact ? null : <p className="mt-2 max-w-xl whitespace-pre-line text-sm leading-6 text-[var(--p-muted)] sm:text-base">{portfolio.bio || "Your considered introduction will appear here."}</p>}</div></div>{portfolio.logoUrl ? <img src={portfolio.logoUrl} alt="Portfolio logo" className="max-h-9 max-w-20 object-contain" /> : null}</div>;
}

function SocialLinks({ links }: { links: PreviewPortfolio["socialLinks"] }) {
  if (!links.length) return null;
  return <div className="flex flex-wrap gap-2">{links.map((link) => { const Icon = socialIcons[link.platform]; return <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border border-[var(--p-border)] bg-[var(--p-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--p-text)] transition-colors hover:bg-[var(--p-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-accent)]"><Icon className="size-3.5" />{link.platform}</a>; })}</div>;
}

export function MinimalTemplate({ portfolio }: { portfolio: PreviewPortfolio }) {
  return <article className="mx-auto max-w-2xl space-y-9 px-7 py-12 sm:px-12 sm:py-16"><Identity portfolio={portfolio} /><div className="h-px bg-[var(--p-border)]" /><div className="space-y-3"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--p-muted)]">Independent practice</p><p className="max-w-xl whitespace-pre-line text-base leading-8 text-[var(--p-muted)]">{portfolio.bio || "A thoughtful description of the work, perspective and ideas that shape your practice."}</p></div><SocialLinks links={portfolio.socialLinks} /></article>;
}

export function GalleryTemplate({ portfolio }: { portfolio: PreviewPortfolio }) {
  return <article className="space-y-8 p-5 sm:p-8"><Identity portfolio={portfolio} compact /><SocialLinks links={portfolio.socialLinks} /><div className="grid gap-3 sm:grid-cols-2">{projectGradients.map((gradient, index) => <article key={gradient} className="overflow-hidden rounded-2xl border border-[var(--p-border)] bg-[var(--p-surface)]"><div className={cn("aspect-[4/3] bg-gradient-to-br", gradient)} /><div className="p-4"><p className="text-sm font-semibold">Selected project {index + 1}</p><p className="mt-1 text-xs text-[var(--p-muted)]">Brand direction · 2026</p></div></article>)}</div></article>;
}

export function CardsTemplate({ portfolio }: { portfolio: PreviewPortfolio }) {
  return <article className="space-y-5 p-5 sm:p-8"><section className="rounded-3xl bg-[var(--p-soft)] p-5 sm:p-7"><Identity portfolio={portfolio} /><div className="mt-5"><SocialLinks links={portfolio.socialLinks} /></div></section><div className="grid gap-3 sm:grid-cols-2">{projectGradients.map((gradient, index) => <article key={gradient} className="rounded-3xl border border-[var(--p-border)] bg-[var(--p-surface)] p-4"><p className="text-xs font-bold tracking-[0.15em] text-[var(--p-accent)]">0{index + 1}</p><div className={cn("mt-6 aspect-[16/10] rounded-2xl bg-gradient-to-br", gradient)} /><p className="mt-4 text-base font-semibold">A work in progress</p><p className="mt-1 text-xs text-[var(--p-muted)]">Product story</p></article>)}</div></article>;
}

export function BlogTemplate({ portfolio }: { portfolio: PreviewPortfolio }) {
  const stories = ["Making space for a more human product practice", "The signals that make a brand feel inevitable", "What I learned from moving more slowly"];
  return <article className="mx-auto max-w-3xl space-y-8 px-7 py-12 sm:px-12 sm:py-16"><Identity portfolio={portfolio} /><SocialLinks links={portfolio.socialLinks} /><div className="h-px bg-[var(--p-border)]" /><section><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--p-muted)]">Field notes</p><div className="mt-4 divide-y divide-[var(--p-border)]">{stories.map((story, index) => <article className="group py-5 first:pt-0" key={story}><p className="text-xs text-[var(--p-muted)]">0{index + 1} · June 2026</p><h2 className="mt-2 text-xl font-semibold tracking-[-0.035em] transition-colors group-hover:text-[var(--p-accent)]">{story}</h2><p className="mt-2 text-sm leading-6 text-[var(--p-muted)]">A short reflection that introduces the idea and gives the reader a reason to keep exploring.</p></article>)}</div></section></article>;
}

const labels: Record<PortfolioTemplate, string> = { minimal: "Minimal", gallery: "Gallery", cards: "Cards", blog: "Blog" };

export function PortfolioPreview({ portfolio, className, showFrame = true }: { portfolio: PreviewPortfolio; className?: string; showFrame?: boolean }) {
  const reduceMotion = useReducedMotion();
  const style = { ...colors[portfolio.colorScheme], "--p-font": fonts[portfolio.fontFamily] } as CSSProperties;
  const content = portfolio.template === "gallery" ? <GalleryTemplate portfolio={portfolio} /> : portfolio.template === "cards" ? <CardsTemplate portfolio={portfolio} /> : portfolio.template === "blog" ? <BlogTemplate portfolio={portfolio} /> : <MinimalTemplate portfolio={portfolio} />;
  return <div className={className}><div className="mb-3 flex items-center justify-between"><p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.13em] text-slate-500 dark:text-slate-400"><span className="size-1.5 rounded-full bg-emerald-500" />Live preview</p><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">{labels[portfolio.template]}</span></div><div style={style} className={cn("overflow-hidden bg-[var(--p-bg)] text-[var(--p-text)] [font-family:var(--p-font)]", showFrame && "rounded-[1.5rem] border border-slate-200 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.35)] dark:border-white/10")}><AnimatePresence mode="wait" initial={false}><motion.div key={portfolio.template} initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -7, scale: 0.99 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>{content}</motion.div></AnimatePresence></div></div>;
}

export function PublicPortfolioHeader({ portfolio }: { portfolio: PreviewPortfolio }) {
  return <header className="flex items-center justify-between border-b border-[var(--p-border)] px-5 py-4 sm:px-8"><span className="font-semibold tracking-[-0.04em]">{portfolio.title}</span><a href="#work" className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--p-accent)]">View work <ArrowUpRight className="size-3.5" /></a></header>;
}
