import { Check, CreditCard, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { AppMark } from "@/components/AppMark";
import { LanguageToggle } from "@/components/LanguageToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { isExternalRuntime } from "@/lib/externalRuntime";
import { trpc } from "@/lib/trpc";

const plans = [
  { id: "starter" as const, price: "490 ₽", features: ["1 portfolio", "7 templates", "Private image storage"] },
  { id: "pro" as const, price: "990 ₽", features: ["Everything in Starter", "Projects and posts", "Priority publishing tools"] },
  { id: "business" as const, price: "1 990 ₽", features: ["Everything in Pro", "Studio workflow", "Business-ready presence"] },
];

export default function BillingPage() {
  const { t, locale } = useLanguage();
  const { isAuthenticated, loading } = useAuth();
  const [, setLocation] = useLocation();
  const entitlement = trpc.billing.me.useQuery(undefined, { enabled: isAuthenticated && isExternalRuntime });
  const checkout = trpc.billing.createCheckout.useMutation();

  async function selectPlan(plan: "starter" | "pro" | "business") {
    try {
      const result = await checkout.mutateAsync({ plan, locale });
      window.location.assign(result.checkoutUrl);
    } catch {
      // Ошибка отображается ниже; секреты и provider details не попадают в браузер.
    }
  }

  if (loading) return <div className="grid min-h-svh place-items-center"><Loader2 className="size-5 animate-spin text-violet-600" /></div>;

  return <div className="min-h-svh bg-[#f8f8fa] text-slate-950 dark:bg-[#090a0f] dark:text-white">
    <header className="border-b border-slate-200/80 bg-[#f8f8fa]/85 backdrop-blur-xl dark:border-white/10 dark:bg-[#090a0f]/85"><div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-5 sm:px-8"><AppMark href={isAuthenticated ? "/dashboard" : "/"} /><div className="flex items-center gap-1.5"><LanguageToggle /><ThemeToggle /><Button className="rounded-full" onClick={() => setLocation(isAuthenticated ? "/dashboard" : "/auth/signin")} variant="ghost">{t("common.dashboard")}</Button></div></div></header>
    <main className="mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
      <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">{t("billing.eyebrow")}</p><h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.06em] sm:text-6xl">{t("billing.title")}</h1><p className="mt-5 text-base leading-7 text-slate-600 dark:text-slate-300">{t("billing.description")}</p></div>
      {!isAuthenticated ? <div className="mt-10 rounded-3xl border border-violet-100 bg-violet-50 p-7 dark:border-violet-400/15 dark:bg-violet-950/25"><p className="font-semibold">{t("billing.signInTitle")}</p><Button className="mt-4 rounded-full bg-violet-700 text-white hover:bg-violet-800" onClick={() => setLocation("/auth/signin")}>{t("billing.signInAction")}</Button></div> : null}
      {entitlement.data ? <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-950 dark:border-emerald-400/20 dark:bg-emerald-950/20 dark:text-emerald-100"><strong>{t("billing.current", { plan: entitlement.data.plan })}</strong>{entitlement.data.currentPeriodEnd ? <span className="ml-2">· {t("billing.ends", { date: new Date(entitlement.data.currentPeriodEnd).toLocaleDateString(locale === "ru" ? "ru-RU" : "en-US") })}</span> : null}</div> : null}
      <div className="mt-10 grid gap-5 lg:grid-cols-3">{plans.map((plan) => <section className={`rounded-[1.75rem] border bg-white p-7 shadow-sm dark:bg-white/[0.035] ${plan.id === "pro" ? "border-violet-400 ring-1 ring-violet-300/60 dark:border-violet-400" : "border-slate-200 dark:border-white/10"}`} key={plan.id}><p className="font-display text-2xl font-semibold tracking-[-0.04em]">{t(`billing.${plan.id}`)}</p><p className="mt-3 min-h-12 text-sm leading-6 text-slate-500 dark:text-slate-400">{t(`billing.${plan.id}Description`)}</p><p className="mt-7 text-3xl font-semibold tracking-[-0.045em]">{plan.price}<span className="ml-1 text-sm font-medium text-slate-500 dark:text-slate-400">{t("billing.perMonth")}</span></p><ul className="mt-7 space-y-3 text-sm text-slate-600 dark:text-slate-300">{plan.features.map((feature) => <li className="flex gap-2" key={feature}><Check className="mt-0.5 size-4 shrink-0 text-violet-600" />{feature}</li>)}</ul><Button className="mt-8 w-full rounded-full bg-violet-700 text-white hover:bg-violet-800" disabled={!isAuthenticated || checkout.isPending} onClick={() => void selectPlan(plan.id)}>{checkout.isPending ? <><Loader2 className="mr-2 size-4 animate-spin" />{t("billing.redirecting")}</> : <><CreditCard className="mr-2 size-4" />{t("billing.choose", { plan: t(`billing.${plan.id}`) })}</>}</Button></section>)}</div>
      {checkout.error ? <p className="mt-6 text-sm text-destructive" role="alert">{t("billing.unavailable")}</p> : null}
    </main>
  </div>;
}
