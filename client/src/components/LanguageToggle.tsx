import { useLanguage } from "@/contexts/LanguageContext";
import type { Locale } from "@/lib/languagePreference";

const options: Array<{ locale: Locale; labelKey: "language.russian" | "language.english" }> = [
  { locale: "ru", labelKey: "language.russian" },
  { locale: "en", labelKey: "language.english" },
];

export function LanguageToggle() {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div
      aria-label={t("language.label")}
      className="inline-flex items-center rounded-full border border-slate-200 bg-white/70 p-0.5 text-xs font-semibold shadow-sm dark:border-white/10 dark:bg-white/5"
      role="group"
    >
      {options.map((option) => {
        const selected = option.locale === locale;
        return (
          <button
            aria-pressed={selected}
            className={`rounded-full px-2.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${selected ? "bg-violet-700 text-white shadow-sm dark:bg-violet-400 dark:text-slate-950" : "text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"}`}
            key={option.locale}
            onClick={() => setLocale(option.locale)}
            type="button"
          >
            {option.locale.toUpperCase()}
            <span className="sr-only"> — {t(option.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}
