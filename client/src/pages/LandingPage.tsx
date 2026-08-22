import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, ChevronRight, LayoutPanelTop, Palette, Sparkles } from "lucide-react";
import { Link, useLocation } from "wouter";
import { AppMark } from "@/components/AppMark";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { useLanguage } from "@/contexts/LanguageContext";
import { isExternalRuntime } from "@/lib/externalRuntime";

function MiniPortfolio() {
  const { t } = useLanguage();
  return (
    <div className="relative mx-auto w-full max-w-[33rem] rounded-[1.65rem] border border-white/70 bg-white/85 p-4 shadow-[0_30px_70px_-28px_rgba(76,29,149,0.34)] backdrop-blur dark:border-white/10 dark:bg-slate-900/85 dark:shadow-black/40">
      <div className="overflow-hidden rounded-[1.15rem] border border-slate-200 bg-[#f7f5ff] dark:border-white/10 dark:bg-[#151322]">
        <div className="h-28 bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.64),transparent_32%),linear-gradient(120deg,#5235bf,#9473ff_50%,#d8ccff)]" />
        <div className="p-5 pt-0"><div className="-mt-9 grid size-[4.5rem] place-items-center rounded-2xl border-4 border-[#f7f5ff] bg-slate-950 text-xl font-semibold text-white shadow-md dark:border-[#151322]">A</div><p className="mt-4 font-display text-2xl font-semibold tracking-[-0.05em] text-slate-950 dark:text-white">Ava Morris</p><p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">{t("landing.demoBio")}</p><div className="mt-5 flex gap-2"><span className="rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-medium text-violet-800 dark:border-violet-400/20 dark:bg-white/5 dark:text-violet-200">{t("landing.demoWork")}</span><span className="rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-medium text-violet-800 dark:border-violet-400/20 dark:bg-white/5 dark:text-violet-200">{t("landing.demoAbout")}</span></div></div>
      </div>
      <div className="absolute -right-5 -top-5 hidden rounded-xl border border-violet-100 bg-white px-3 py-2 text-xs font-semibold text-violet-900 shadow-lg sm:block dark:border-violet-400/20 dark:bg-slate-800 dark:text-violet-100">{t("landing.start")}</div>
    </div>
  );
}

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const reduceMotion = useReducedMotion();
  const { t } = useLanguage();
  const goToDashboard = () => setLocation("/dashboard");
  const signIn = () => isAuthenticated ? goToDashboard() : isExternalRuntime ? setLocation("/auth/signin") : startLogin();
  const features = [
    { icon: LayoutPanelTop, title: t("landing.featureLayoutsTitle"), text: t("landing.featureLayoutsText") },
    { icon: Palette, title: t("landing.featureVisualTitle"), text: t("landing.featureVisualText") },
    { icon: Sparkles, title: t("landing.featureControlTitle"), text: t("landing.featureControlText") },
  ];

  return (
    <div className="min-h-svh overflow-hidden bg-[#fcfcfd] text-slate-950 selection:bg-violet-200 dark:bg-[#090a0f] dark:text-white">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] bg-[radial-gradient(ellipse_at_52%_0%,rgba(196,181,253,0.42),transparent_47%),radial-gradient(ellipse_at_94%_20%,rgba(221,214,254,0.45),transparent_35%)] dark:bg-[radial-gradient(ellipse_at_52%_0%,rgba(109,40,217,0.25),transparent_42%)]" />
      <header className="relative mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8"><AppMark /><nav className="flex items-center gap-1.5"><LanguageToggle /><ThemeToggle /><Button className="hidden rounded-full px-4 text-slate-700 hover:bg-white/80 hover:text-slate-950 sm:inline-flex dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white" onClick={signIn} variant="ghost">{isAuthenticated ? t("common.dashboard") : t("landing.login")}</Button><Button className="rounded-full bg-slate-950 px-5 text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200" onClick={signIn}>{t("landing.start")} <ArrowRight className="ml-1.5 size-4" /></Button></nav></header>
      <main className="relative">
        <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 pb-24 pt-16 sm:px-8 md:pb-32 md:pt-24 lg:grid-cols-[1.02fr_.98fr] lg:gap-16">
          <motion.div animate={{ opacity: 1, y: 0 }} initial={reduceMotion ? false : { opacity: 0, y: 14 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}><p className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-200/80 bg-white/70 px-3 py-1.5 text-xs font-semibold tracking-[0.02em] text-violet-800 shadow-sm backdrop-blur dark:border-violet-400/20 dark:bg-violet-950/30 dark:text-violet-200"><span className="size-1.5 rounded-full bg-violet-500" />{t("landing.eyebrow")}</p><h1 className="max-w-3xl font-display text-5xl font-semibold leading-[0.96] tracking-[-0.068em] sm:text-6xl lg:text-7xl">{t("landing.titleBefore")} <span className="text-violet-700 dark:text-violet-300">{t("landing.titleAccent")}</span></h1><p className="mt-7 max-w-xl text-base leading-7 text-slate-600 sm:text-lg dark:text-slate-300">{t("landing.description")}</p><div className="mt-9 flex flex-col gap-3 sm:flex-row"><Button className="h-12 rounded-full bg-violet-700 px-6 text-white shadow-[0_12px_24px_-12px_rgba(109,40,217,0.8)] hover:bg-violet-800 dark:bg-violet-500 dark:hover:bg-violet-400" onClick={signIn} size="lg">{t("landing.create")} <ArrowRight className="ml-1.5 size-4" /></Button><Link className="inline-flex h-12 items-center justify-center rounded-full px-5 text-sm font-semibold text-slate-700 transition-colors hover:text-violet-700 focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-slate-300 dark:hover:text-violet-300" href="#how-it-works">{t("landing.how")} <ChevronRight className="ml-1 size-4" /></Link></div><div className="mt-11 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500 dark:text-slate-400">{[t("landing.noCode"), t("landing.publish"), t("landing.evolve")].map((item) => <span className="inline-flex items-center gap-1.5" key={item}><Check className="size-4 text-violet-600 dark:text-violet-400" />{item}</span>)}</div></motion.div>
          <motion.div animate={{ opacity: 1, y: 0, rotate: 0 }} initial={reduceMotion ? false : { opacity: 0, y: 20, rotate: 1 }} transition={{ duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}><MiniPortfolio /></motion.div>
        </section>
        <section className="border-y border-slate-200/80 bg-white/60 py-20 dark:border-white/10 dark:bg-white/[0.025]" id="how-it-works"><div className="mx-auto max-w-7xl px-5 sm:px-8"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.15em] text-violet-700 dark:text-violet-300">{t("landing.sectionEyebrow")}</p><h2 className="mt-4 font-display text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">{t("landing.sectionTitle")}</h2></div><div className="mt-14 grid gap-8 md:grid-cols-3">{features.map((feature, index) => <motion.article className="rounded-[1.4rem] border border-slate-200 bg-white p-6 shadow-[0_12px_25px_-25px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-slate-900/60" initial={reduceMotion ? false : { opacity: 0, y: 10 }} key={feature.title} transition={{ duration: 0.35, delay: index * 0.06 }} viewport={{ once: true, amount: 0.35 }} whileInView={{ opacity: 1, y: 0 }}><div className="grid size-10 place-items-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300"><feature.icon className="size-5" /></div><h3 className="mt-6 text-lg font-semibold tracking-[-0.03em]">{feature.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{feature.text}</p></motion.article>)}</div></div></section>
      </main>
    </div>
  );
}
