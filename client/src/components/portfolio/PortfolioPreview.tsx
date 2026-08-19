import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { CSSProperties } from "react";
import type { PortfolioColorScheme, PortfolioFontFamily, PortfolioInput, PortfolioTemplate } from "@shared/portfolio";
import { cn } from "@/lib/utils";
import { AgencyTemplate } from "./templates/AgencyTemplate";
import { BlogTemplate } from "./templates/BlogTemplate";
import { CardsTemplate } from "./templates/CardsTemplate";
import { CreativeTemplate } from "./templates/CreativeTemplate";
import { GalleryTemplate } from "./templates/GalleryTemplate";
import { MinimalTemplate } from "./templates/MinimalTemplate";
import { ShowcaseTemplate } from "./templates/ShowcaseTemplate";

export type PreviewPortfolio = Pick<PortfolioInput, "title" | "bio" | "logoUrl" | "avatarUrl" | "socialLinks" | "template" | "colorScheme" | "fontFamily" | "projects" | "services" | "posts" | "contactEmail">;

const colors: Record<PortfolioColorScheme, Record<string, string>> = {
  blue: { "--p-bg": "#f2f7ff", "--p-surface": "#ffffff", "--p-text": "#10213f", "--p-muted": "#55709c", "--p-accent": "#2764d8", "--p-soft": "#dbeafe", "--p-border": "#cbdcf8" },
  dark: { "--p-bg": "#101218", "--p-surface": "#191c25", "--p-text": "#f7f7fa", "--p-muted": "#aeb5c7", "--p-accent": "#a78bfa", "--p-soft": "#2a2445", "--p-border": "#323746" },
  purple: { "--p-bg": "#f8f4ff", "--p-surface": "#ffffff", "--p-text": "#27144b", "--p-muted": "#7658aa", "--p-accent": "#7544d7", "--p-soft": "#ede5ff", "--p-border": "#dfd1ff" },
  green: { "--p-bg": "#f0faf5", "--p-surface": "#ffffff", "--p-text": "#0c3524", "--p-muted": "#4b8065", "--p-accent": "#0f8b55", "--p-soft": "#d8f4e5", "--p-border": "#bee8d1" },
  warm: { "--p-bg": "#fff7ed", "--p-surface": "#ffffff", "--p-text": "#451a03", "--p-muted": "#9a5b23", "--p-accent": "#c2410c", "--p-soft": "#ffedd5", "--p-border": "#fed7aa" },
};

const fonts: Record<PortfolioFontFamily, string> = { inter: '"DM Sans", ui-sans-serif, system-ui, sans-serif', playfair: '"DM Serif Display", Georgia, serif', georgia: "Georgia, serif" };
const labels: Record<PortfolioTemplate, string> = { minimal: "Minimal", gallery: "Gallery", cards: "Cards", blog: "Blog", creative: "Creative", agency: "Agency", showcase: "Showcase" };

function TemplateContent({ portfolio }: { portfolio: PreviewPortfolio }) {
  switch (portfolio.template) {
    case "gallery": return <GalleryTemplate portfolio={portfolio} />;
    case "cards": return <CardsTemplate portfolio={portfolio} />;
    case "blog": return <BlogTemplate portfolio={portfolio} />;
    case "creative": return <CreativeTemplate portfolio={portfolio} />;
    case "agency": return <AgencyTemplate portfolio={portfolio} />;
    case "showcase": return <ShowcaseTemplate portfolio={portfolio} />;
    default: return <MinimalTemplate portfolio={portfolio} />;
  }
}

export function PortfolioPreview({ portfolio, className, showFrame = true }: { portfolio: PreviewPortfolio; className?: string; showFrame?: boolean }) {
  const reduceMotion = useReducedMotion();
  const style = { ...colors[portfolio.colorScheme], "--p-font": fonts[portfolio.fontFamily] } as CSSProperties;
  return <div className={className}>{showFrame ? <div className="mb-3 flex items-center justify-between print:hidden"><p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.13em] text-slate-500 dark:text-slate-400"><span className="size-1.5 rounded-full bg-emerald-500" />Live preview</p><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">{labels[portfolio.template]}</span></div> : null}<div style={style} className={cn("bg-[var(--p-bg)] text-[var(--p-text)] [font-family:var(--p-font)] print:bg-white print:text-black", showFrame && "overflow-hidden rounded-[1.5rem] border border-slate-200 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.35)] dark:border-white/10 print:rounded-none print:border-0 print:shadow-none", !showFrame && "min-h-svh")}><AnimatePresence mode="wait" initial={false}><motion.div key={portfolio.template} initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -7, scale: 0.99 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}><TemplateContent portfolio={portfolio} /></motion.div></AnimatePresence></div></div>;
}
