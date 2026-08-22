import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { EditorStatusToast } from "./EditorStatusToast";

function renderSaveBar(locale: "en" | "ru"): string {
  const getItem = vi.fn((key: string) => key === "portfolio-pro.locale" ? locale : null);
  vi.stubGlobal("window", { localStorage: { getItem, setItem: vi.fn() } });

  return renderToStaticMarkup(
    <LanguageProvider>
      <EditorStatusToast onCancel={() => undefined} onSave={() => undefined} status="dirty" />
    </LanguageProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("EditorStatusToast localization", () => {
  it("renders Russian dirty-state copy when RU is persisted", () => {
    const html = renderSaveBar("ru");
    expect(html).toContain("Есть несохранённые изменения");
    expect(html).toContain("Отменить");
    expect(html).toContain("Сохранить");
  });

  it("renders English dirty-state copy when EN is persisted", () => {
    const html = renderSaveBar("en");
    expect(html).toContain("You have unsaved changes");
    expect(html).toContain("Cancel");
    expect(html).toContain("Save");
  });
});
