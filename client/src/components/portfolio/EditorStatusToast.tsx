import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertCircle, CheckCircle2, Cloud, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type EditorStatus = "idle" | "dirty" | "saving" | "saved" | "error";

const toast = {
  dirty: { icon: Cloud, detail: "Unsaved changes", tone: "border-amber-400/40 bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100" },
  saving: { icon: Loader2, detail: "Saving changes", tone: "border-violet-400/35 bg-violet-50 text-violet-950 dark:bg-violet-950/40 dark:text-violet-100" },
  saved: { icon: CheckCircle2, detail: "All changes saved", tone: "border-emerald-400/40 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/35 dark:text-emerald-100" },
  error: { icon: AlertCircle, detail: "Couldn’t save changes", tone: "border-red-400/40 bg-red-50 text-red-950 dark:bg-red-950/35 dark:text-red-100" },
} as const;

export function EditorStatusToast({ status, message }: { status: EditorStatus; message?: string }) {
  const reduceMotion = useReducedMotion();
  if (status === "idle") return null;
  const item = toast[status];
  const Icon = item.icon;
  return <AnimatePresence><motion.div key={status} role={status === "error" ? "alert" : "status"} aria-live={status === "error" ? "assertive" : "polite"} initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }} transition={{ duration: 0.18 }} className={cn("fixed bottom-5 right-5 z-50 flex max-w-[calc(100vw-2.5rem)] items-start gap-3 rounded-xl border px-4 py-3 shadow-xl", item.tone)}><Icon className={cn("mt-0.5 size-4 shrink-0", status === "saving" && "animate-spin")} /><div><p className="text-xs font-bold uppercase tracking-[0.14em]">{status}</p><p className="mt-0.5 text-sm font-semibold">{message || item.detail}</p></div></motion.div></AnimatePresence>;
}
