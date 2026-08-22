import type { Locale } from "./languagePreference";

export type EditorSaveBarStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export type EditorSaveBarState = {
  visible: boolean;
  canCancel: boolean;
  canSave: boolean;
  title: string;
  detail: string;
};

export type EditorStoragePaths = { logo: string; avatar: string };

export function cloneEditorStoragePaths(paths: EditorStoragePaths): EditorStoragePaths {
  return { logo: paths.logo, avatar: paths.avatar };
}

const copy = {
  en: {
    savingTitle: "Saving changes",
    savingDetail: "Please keep this page open.",
    errorTitle: "We could not save your changes",
    errorDetail: "Check your connection and try again.",
    dirtyTitle: "You have unsaved changes",
    dirtyDetail: "Live preview is already updated. Save when you are ready.",
  },
  ru: {
    savingTitle: "Сохраняем изменения",
    savingDetail: "Пожалуйста, не закрывайте страницу.",
    errorTitle: "Не удалось сохранить изменения",
    errorDetail: "Проверьте подключение и повторите попытку.",
    dirtyTitle: "Есть несохранённые изменения",
    dirtyDetail: "Live preview уже обновлён. Сохраните изменения, когда будете готовы.",
  },
} as const;

export function getEditorSaveBarState(status: EditorSaveBarStatus, message?: string, locale: Locale = "ru"): EditorSaveBarState {
  if (status === "idle" || status === "saved") {
    return { visible: false, canCancel: false, canSave: false, title: "", detail: "" };
  }

  if (status === "saving") {
    return { visible: true, canCancel: false, canSave: false, title: copy[locale].savingTitle, detail: copy[locale].savingDetail };
  }

  if (status === "error") {
    return { visible: true, canCancel: true, canSave: true, title: copy[locale].errorTitle, detail: message || copy[locale].errorDetail };
  }

  return { visible: true, canCancel: true, canSave: true, title: copy[locale].dirtyTitle, detail: copy[locale].dirtyDetail };
}
