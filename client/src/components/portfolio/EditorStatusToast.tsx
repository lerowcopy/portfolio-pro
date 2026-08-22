import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertCircle, CheckCircle2, Loader2, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { getEditorSaveBarState, type EditorSaveBarStatus } from "@/lib/editorSaveBarState";

export type EditorStatus = EditorSaveBarStatus;

export function EditorStatusToast({ status, message, onCancel, onSave }: { status: EditorStatus; message?: string; onCancel: () => void; onSave: () => void }) {
  const reduceMotion = useReducedMotion();
  const { locale, t } = useLanguage();
  const bar = getEditorSaveBarState(status, message, locale);

  if (status === "saved") {
    return <AnimatePresence><motion.div key="saved" role="status" aria-live="polite" initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }} transition={{ duration: 0.18 }} className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-50 px-4 py-3 text-emerald-950 shadow-xl dark:bg-emerald-950/35 dark:text-emerald-100"><CheckCircle2 className="size-4" /><p className="text-sm font-semibold">{t("editor.saved")}</p></motion.div></AnimatePresence>;
  }

  if (!bar.visible) return null;
  const Icon = status === "saving" ? Loader2 : status === "error" ? AlertCircle : Save;
  const tone = status === "error" ? "border-red-300 bg-red-50 text-red-950 dark:border-red-400/35 dark:bg-red-950/35 dark:text-red-100" : "border-violet-300 bg-white text-slate-950 dark:border-violet-400/35 dark:bg-slate-900 dark:text-white";

  return <AnimatePresence><motion.div key={status} role={status === "error" ? "alert" : "status"} aria-live={status === "error" ? "assertive" : "polite"} initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }} transition={{ duration: 0.18 }} className={cn("fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border p-3 shadow-2xl backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-4", tone)}><div className="flex min-w-0 items-start gap-3"><Icon className={cn("mt-0.5 size-5 shrink-0", status === "saving" && "animate-spin")} /><div><p className="text-sm font-semibold">{bar.title}</p><p className="mt-0.5 text-xs leading-5 opacity-75">{bar.detail}</p></div></div><div className="flex shrink-0 gap-2"><Button type="button" variant="outline" size="sm" disabled={!bar.canCancel} onClick={onCancel} className="rounded-full bg-transparent"><RotateCcw className="mr-1.5 size-3.5" />{t("editor.cancel")}</Button><Button type="button" size="sm" disabled={!bar.canSave} onClick={onSave} className="rounded-full bg-violet-700 text-white hover:bg-violet-800 dark:bg-violet-500 dark:hover:bg-violet-400"><Save className="mr-1.5 size-3.5" />{status === "saving" ? t("editor.saving") : t("editor.save")}</Button></div></motion.div></AnimatePresence>;
}
