import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cloneEditorStoragePaths, getEditorSaveBarState } from "./editorSaveBarState";

describe("getEditorSaveBarState", () => {
  it("shows Cancel and Save actions only while there are unsaved changes", () => {
    expect(getEditorSaveBarState("dirty")).toMatchObject({
      visible: true,
      canCancel: true,
      canSave: true,
      title: "Есть несохранённые изменения",
    });
    expect(getEditorSaveBarState("saved")).toMatchObject({ visible: false, canCancel: false, canSave: false });
  });

  it("keeps the bar visible after a save error and allows a retry", () => {
    expect(getEditorSaveBarState("error", "Сеть недоступна")).toMatchObject({
      visible: true,
      canCancel: true,
      canSave: true,
      detail: "Сеть недоступна",
    });
  });

  it("disables both actions while an explicit save is in progress", () => {
    expect(getEditorSaveBarState("saving")).toMatchObject({
      visible: true,
      canCancel: false,
      canSave: false,
      title: "Сохраняем изменения",
    });
  });

  it("returns English panel copy for the English interface", () => {
    expect(getEditorSaveBarState("dirty", undefined, "en")).toMatchObject({
      title: "You have unsaved changes",
      detail: "Live preview is already updated. Save when you are ready.",
    });
  });

  it("keeps saved image paths independent from later draft mutations", () => {
    const saved = cloneEditorStoragePaths({ logo: "storage://logos/saved", avatar: "storage://avatars/saved" });
    const draft = cloneEditorStoragePaths(saved);
    draft.logo = "storage://logos/draft";
    draft.avatar = "";

    expect(saved).toEqual({ logo: "storage://logos/saved", avatar: "storage://avatars/saved" });
  });

  it("uses only explicit Save and Cancel actions without interval or visibility autosave", () => {
    const source = readFileSync(new URL("../pages/PortfolioEditorPage.tsx", import.meta.url), "utf8");

    expect(source).toContain("onCancel={cancelChanges}");
    expect(source).toContain("onSave={() => void save()}");
    expect(source).not.toContain("setInterval");
    expect(source).not.toContain("visibilitychange");
  });
});
