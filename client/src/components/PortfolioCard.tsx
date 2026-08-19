import { ArrowUpRight, Copy, Edit3, MoreHorizontal, Trash2 } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { PortfolioColorScheme } from "@shared/portfolio";

type PortfolioCardProps = {
  portfolio: { id: number; title: string; slug: string; bio: string; avatarUrl: string; colorScheme: PortfolioColorScheme; isPublished: boolean; updatedAt: Date | string };
  onDelete: (id: number) => void;
};

const swatches: Record<PortfolioColorScheme, string> = {
  blue: "from-sky-400 via-blue-500 to-indigo-700",
  dark: "from-slate-700 via-slate-900 to-black",
  purple: "from-fuchsia-400 via-violet-500 to-indigo-800",
  green: "from-emerald-300 via-teal-500 to-cyan-700",
};

export function PortfolioCard({ portfolio, onDelete }: PortfolioCardProps) {
  const date = new Date(portfolio.updatedAt).toLocaleDateString("en", { month: "short", day: "numeric" });
  const initials = portfolio.title.slice(0, 1).toUpperCase() || "P";

  return (
    <article className="group overflow-hidden rounded-[1.45rem] border border-slate-200/90 bg-white shadow-[0_12px_32px_-22px_rgba(15,23,42,0.28)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_45px_-25px_rgba(15,23,42,0.38)] dark:border-white/10 dark:bg-slate-900/80 dark:shadow-black/20">
      <div className={`relative h-32 overflow-hidden bg-gradient-to-br ${swatches[portfolio.colorScheme]}`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.38),transparent_36%),linear-gradient(115deg,transparent_34%,rgba(255,255,255,0.16),transparent_35%)]" />
        <div className="absolute right-4 top-4"><Badge className={portfolio.isPublished ? "border-0 bg-white/90 text-slate-900 hover:bg-white" : "border-0 bg-slate-950/35 text-white hover:bg-slate-950/35"}>{portfolio.isPublished ? "Published" : "Draft"}</Badge></div>
      </div>
      <div className="relative p-5 pt-0">
        <div className="-mt-8 flex items-end justify-between gap-3">
          <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border-4 border-white bg-slate-100 text-xl font-semibold text-slate-700 shadow-sm dark:border-slate-900 dark:bg-slate-800 dark:text-slate-200">
            {portfolio.avatarUrl ? <img className="size-full object-cover" src={portfolio.avatarUrl} alt="" /> : initials}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="mb-1 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-white/10 dark:hover:text-white" aria-label={`More actions for ${portfolio.title}`}><MoreHorizontal className="size-5" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-xl border-slate-200 p-1.5 dark:border-white/10">
              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(`${window.location.origin}/${portfolio.slug}`)} className="rounded-lg"><Copy className="mr-2 size-4" />Copy public URL</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDelete(portfolio.id)} className="rounded-lg text-destructive focus:text-destructive"><Trash2 className="mr-2 size-4" />Delete</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="mt-4">
          <Link href={`/dashboard/portfolios/${portfolio.id}/edit`} className="group/title inline-flex max-w-full items-center gap-1.5 rounded-md text-lg font-semibold tracking-[-0.03em] text-slate-950 outline-none transition-colors hover:text-violet-700 focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-white dark:hover:text-violet-300"><span className="truncate">{portfolio.title}</span><Edit3 className="size-3.5 opacity-0 transition-opacity group-hover/title:opacity-100" /></Link>
          <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">/{portfolio.slug}</p>
          <div className="mt-5 flex items-center justify-between"><p className="text-xs text-slate-400 dark:text-slate-500">Updated {date}</p>{portfolio.isPublished ? <a href={`/${portfolio.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md text-xs font-semibold text-violet-700 transition-colors hover:text-violet-900 focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-violet-300"><span>View</span><ArrowUpRight className="size-3.5" /></a> : <span className="text-xs font-medium text-slate-400">Private</span>}</div>
        </div>
      </div>
    </article>
  );
}
