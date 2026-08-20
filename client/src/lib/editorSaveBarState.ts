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

export function getEditorSaveBarState(status: EditorSaveBarStatus, message?: string): EditorSaveBarState {
  if (status === "idle" || status === "saved") {
    return { visible: false, canCancel: false, canSave: false, title: "", detail: "" };
  }

  if (status === "saving") {
    return { visible: true, canCancel: false, canSave: false, title: "Сохраняем изменения", detail: "Пожалуйста, не закрывайте страницу." };
  }

  if (status === "error") {
    return { visible: true, canCancel: true, canSave: true, title: "Не удалось сохранить изменения", detail: message || "Проверьте подключение и повторите попытку." };
  }

  return { visible: true, canCancel: true, canSave: true, title: "Есть несохранённые изменения", detail: "Live preview уже обновлён. Сохраните изменения, когда будете готовы." };
}
