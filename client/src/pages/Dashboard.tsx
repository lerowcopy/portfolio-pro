import { useState } from "react";
import { FolderPlus, LayoutDashboard, Loader2, Plus, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { AppMark } from "@/components/AppMark";
import { LanguageToggle } from "@/components/LanguageToggle";
import { PortfolioCard } from "@/components/PortfolioCard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { useLanguage } from "@/contexts/LanguageContext";
import { isExternalRuntime } from "@/lib/externalRuntime";
import { portfolioEditorPath } from "@/lib/portfolioRoutes";
import { trpc } from "@/lib/trpc";

export default function Dashboard() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string>();
  const utils = trpc.useUtils();
  const list = trpc.portfolios.list.useQuery(undefined, { enabled: isAuthenticated });
  const create = trpc.portfolios.create.useMutation();
  const remove = trpc.portfolios.remove.useMutation({ onSuccess: () => void utils.portfolios.list.invalidate() });

  if (loading) return <div className="grid min-h-svh place-items-center bg-[#fcfcfd] dark:bg-[#090a0f]"><Loader2 className="size-5 animate-spin text-violet-600" /></div>;
  if (!isAuthenticated) return <div className="grid min-h-svh place-items-center bg-[#fcfcfd] p-6 dark:bg-[#090a0f]"><div className="max-w-sm text-center"><AppMark className="justify-center" /><h1 className="mt-8 font-display text-3xl font-semibold tracking-[-0.05em]">{t("dashboard.unauthTitle")}</h1><p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{t("dashboard.unauthDescription")}</p><Button className="mt-7 rounded-full bg-violet-700 px-5 text-white hover:bg-violet-800" onClick={() => isExternalRuntime ? setLocation("/auth/signin") : startLogin()}>{isExternalRuntime ? t("dashboard.continueEmail") : t("dashboard.continueManus")}</Button></div></div>;

  async function createPortfolio() {
    setCreating(true);
    setCreateError(undefined);
    try {
      const portfolio = await create.mutateAsync();
      const editorPath = portfolioEditorPath((portfolio as { id: string | number }).id);
      void utils.portfolios.list.invalidate();
      if (isExternalRuntime) {
        window.location.assign(editorPath);
        return;
      }
      setLocation(editorPath);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : t("dashboard.createError"));
    } finally {
      setCreating(false);
    }
  }

  const portfolios = list.data ?? [];
  const description = portfolios.length ? t("dashboard.descriptionCount", { count: portfolios.length }) : t("dashboard.descriptionEmpty");

  return (
    <div className="min-h-svh bg-[#f8f8fa] text-slate-950 dark:bg-[#090a0f] dark:text-white">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-[#f8f8fa]/85 backdrop-blur-xl dark:border-white/10 dark:bg-[#090a0f]/85"><div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-5 sm:px-8"><AppMark href="/dashboard" /><div className="flex items-center gap-1.5"><LanguageToggle /><ThemeToggle /><div className="hidden items-center gap-2 border-l border-slate-200 pl-3 sm:flex dark:border-white/10"><div className="grid size-7 place-items-center rounded-full bg-violet-100 text-xs font-semibold text-violet-800 dark:bg-violet-400/15 dark:text-violet-200">{user?.name?.slice(0, 1).toUpperCase() || "P"}</div><Button className="h-8 rounded-full px-3 text-xs text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white" onClick={logout} variant="ghost">{t("dashboard.logout")}</Button></div></div></div></header>
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-7 sm:px-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:py-10">
        <aside className="hidden lg:block"><nav className="sticky top-28 space-y-1"><a className="flex h-10 items-center gap-3 rounded-xl bg-white px-3 text-sm font-semibold text-slate-950 shadow-sm dark:bg-white/10 dark:text-white" href="/dashboard"><LayoutDashboard className="size-4 text-violet-600 dark:text-violet-300" />{t("dashboard.portfolios")}</a><div className="mt-7 rounded-2xl border border-violet-100 bg-violet-50/70 p-4 dark:border-violet-400/15 dark:bg-violet-950/20"><Sparkles className="size-4 text-violet-700 dark:text-violet-300" /><p className="mt-3 text-xs font-semibold text-violet-950 dark:text-violet-100">{t("dashboard.sidebarTitle")}</p><p className="mt-1 text-xs leading-5 text-violet-800/70 dark:text-violet-200/60">{t("dashboard.sidebarDescription")}</p></div></nav></aside>
        <main><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">{t("dashboard.eyebrow")}</p><h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.06em] sm:text-5xl">{t("dashboard.portfolios")}</h1><p className="mt-3 text-sm text-slate-500 dark:text-slate-400">{description}</p></div><Button className="h-11 rounded-full bg-violet-700 px-5 text-white hover:bg-violet-800 dark:bg-violet-500 dark:hover:bg-violet-400" disabled={creating} onClick={createPortfolio}><Plus className="mr-1.5 size-4" />{creating ? t("dashboard.creating") : t("dashboard.create")}</Button></div>{createError ? <div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive" role="alert">{createError}</div> : null}{list.isLoading ? <div className="grid min-h-64 place-items-center"><Loader2 className="size-5 animate-spin text-violet-600" /></div> : list.error ? <div className="mt-10 rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">{t("dashboard.loadError")}</div> : portfolios.length ? <div className="mt-9 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{portfolios.map((portfolio) => <PortfolioCard key={portfolio.id} onDelete={(id) => { if (window.confirm(t("dashboard.deleteConfirm"))) remove.mutate({ id: id as never }); }} portfolio={portfolio} />)}</div> : <div className="mt-9 grid min-h-[24rem] place-items-center rounded-[1.75rem] border border-dashed border-slate-300 bg-white/60 p-8 text-center dark:border-white/15 dark:bg-white/[0.025]"><div><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300"><FolderPlus className="size-6" /></div><h2 className="mt-5 font-display text-2xl font-semibold tracking-[-0.045em]">{t("dashboard.emptyTitle")}</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">{t("dashboard.emptyDescription")}</p><Button className="mt-6 rounded-full bg-violet-700 text-white hover:bg-violet-800" disabled={creating} onClick={createPortfolio}>{t("dashboard.createFirst")}</Button></div></div>}</main>
      </div>
    </div>
  );
}
