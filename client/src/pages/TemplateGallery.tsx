import React, { useState } from "react";
import { ArrowLeft, Check, Eye } from "lucide-react";
import { Link } from "wouter";
import { AppMark } from "@/components/AppMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PortfolioPreview } from "@/components/portfolio/PortfolioPreview";
import { Button } from "@/components/ui/button";
import type { PortfolioInput, PortfolioColorScheme, PortfolioFontFamily, PortfolioTemplate } from "@shared/portfolio";

const templates: PortfolioTemplate[] = ["minimal", "gallery", "cards", "blog", "creative", "agency", "showcase"];
const colors: PortfolioColorScheme[] = ["blue", "dark", "purple", "green", "warm"];
const fonts: PortfolioFontFamily[] = ["inter", "playfair", "georgia"];

const paletteDots: Record<PortfolioColorScheme, string> = { blue: "bg-blue-600", dark: "bg-slate-900", purple: "bg-violet-600", green: "bg-emerald-600", warm: "bg-orange-600" };

const mockPortfolio: PortfolioInput = {
  title: "John Doe — Product Designer",
  bio: "Crafting digital experiences that matter. I help products feel clear, human, and impossible to ignore.",
  avatarUrl: "",
  logoUrl: "",
  socialLinks: [{ id: "linkedin", platform: "linkedin", url: "https://linkedin.com/in/johndoe" }, { id: "twitter", platform: "twitter", url: "https://twitter.com/johndoe" }],
  template: "minimal",
  colorScheme: "purple",
  fontFamily: "inter",
  projects: [
    { id: "fitness", title: "Mobile App Redesign", description: "Complete overhaul of a fitness app that made daily practice feel more achievable.", images: [], tags: ["UI Design", "UX"], year: "2026" },
    { id: "banking", title: "Future of Banking", description: "A more generous digital account for people building a life of their own.", images: [], tags: ["Product", "Strategy"], year: "2025" },
    { id: "culture", title: "Culture in Motion", description: "An editorial platform for a new generation of cultural explorers.", images: [], tags: ["Brand", "Web"], year: "2025" },
    { id: "music", title: "Sound Studies", description: "A modular identity and digital space for a global audio collective.", images: [], tags: ["Identity", "Art direction"], year: "2024" },
  ],
  services: [{ id: "strategy", title: "Product strategy", description: "Turning ambiguous opportunity into a shared direction." }, { id: "experience", title: "Experience design", description: "Making every interaction feel considered and easy." }, { id: "systems", title: "Design systems", description: "Building foundations that help good work travel further." }],
  posts: [{ id: "momentum", title: "Designing for momentum", excerpt: "A few observations on making progress visible in complex product teams.", date: "June 2026" }, { id: "taste", title: "Taste is a practice", excerpt: "Why clearer visual decisions often start with better questions.", date: "May 2026" }],
  contactEmail: "hello@johndoe.design",
  slug: "john-doe",
  slugManuallyEdited: false,
  isPublished: true,
};

export default function TemplateGallery() {
  const [template, setTemplate] = useState<PortfolioTemplate>(() => readChoice("template", templates, "minimal"));
  const [colorScheme, setColorScheme] = useState<PortfolioColorScheme>(() => readChoice("color", colors, "purple"));
  const [fontFamily, setFontFamily] = useState<PortfolioFontFamily>(() => readChoice("font", fonts, "inter"));
  const portfolio = { ...mockPortfolio, template, colorScheme, fontFamily };
  return <div className="min-h-svh bg-[#f8f8fa] text-slate-950 dark:bg-[#090a0f] dark:text-white print:bg-white print:text-black"><header className="sticky top-0 z-30 border-b border-slate-200/80 bg-[#f8f8fa]/90 backdrop-blur-xl dark:border-white/10 dark:bg-[#090a0f]/90 print:hidden"><div className="mx-auto flex h-[4.5rem] max-w-[100rem] items-center justify-between px-5 sm:px-8"><AppMark /><div className="flex items-center gap-2"><ThemeToggle /><Button asChild variant="outline" size="sm" className="rounded-full"><Link href="/"><ArrowLeft className="mr-1.5 size-3.5" />Home</Link></Button></div></div></header><main className="mx-auto max-w-[100rem] px-5 py-9 sm:px-8 sm:py-12 print:px-0 print:py-0"><div className="max-w-3xl print:hidden"><p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">Template library</p><h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.06em] sm:text-6xl">Seven ways to make the work yours.</h1><p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-400">Explore a sample profile across every layout, palette and typography pairing. The same visual controls are available in the portfolio editor.</p></div><div className="mt-10 grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] print:mt-0 print:block"><aside className="space-y-7 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900 lg:h-fit lg:sticky lg:top-24 print:hidden"><ControlGroup title="Template">{templates.map((item) => <button key={item} type="button" onClick={() => setTemplate(item)} aria-pressed={template === item} className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-violet-50 aria-[pressed=true]:bg-violet-100 aria-[pressed=true]:text-violet-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 dark:hover:bg-white/10 dark:aria-[pressed=true]:bg-violet-400/15 dark:aria-[pressed=true]:text-violet-100"><span className="capitalize">{item}</span>{template === item ? <Check className="size-4" /> : null}</button>)}</ControlGroup><ControlGroup title="Colour scheme">{colors.map((item) => <button key={item} type="button" onClick={() => setColorScheme(item)} aria-pressed={colorScheme === item} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-violet-50 aria-[pressed=true]:bg-violet-100 aria-[pressed=true]:text-violet-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 dark:hover:bg-white/10 dark:aria-[pressed=true]:bg-violet-400/15 dark:aria-[pressed=true]:text-violet-100"><span className={`size-3 rounded-full ${paletteDots[item]}`} /><span className="capitalize">{item}</span>{colorScheme === item ? <Check className="ml-auto size-4" /> : null}</button>)}</ControlGroup><ControlGroup title="Typography">{fonts.map((item) => <button key={item} type="button" onClick={() => setFontFamily(item)} aria-pressed={fontFamily === item} className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors hover:bg-violet-50 aria-[pressed=true]:bg-violet-100 aria-[pressed=true]:text-violet-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 dark:hover:bg-white/10 dark:aria-[pressed=true]:bg-violet-400/15 dark:aria-[pressed=true]:text-violet-100"><span className="capitalize">{item}</span>{fontFamily === item ? <Check className="size-4" /> : null}</button>)}</ControlGroup></aside><section aria-label="Template preview" className="min-w-0"><div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 print:hidden"><Eye className="size-4" />Interactive sample</div><PortfolioPreview portfolio={portfolio} /></section></div></main></div>;
}

function ControlGroup({ title, children }: { title: string; children: React.ReactNode }) { return <div><h2 className="mb-2 px-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">{title}</h2><div className="space-y-1">{children}</div></div>; }

function readChoice<T extends string>(key: string, choices: readonly T[], fallback: T): T {
  const value = new URLSearchParams(window.location.search).get(key);
  return value && choices.includes(value as T) ? value as T : fallback;
}
