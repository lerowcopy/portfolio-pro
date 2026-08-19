import { Aperture } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export function AppMark({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2", className)} aria-label="Portfolio Pro home">
      <span className="grid size-8 place-items-center rounded-xl bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"><Aperture className="size-4" strokeWidth={2.35} /></span>
      <span className="font-display text-[1.05rem] font-semibold tracking-[-0.045em] text-slate-950 dark:text-white">Portfolio<span className="text-violet-600 dark:text-violet-400">.pro</span></span>
    </Link>
  );
}
