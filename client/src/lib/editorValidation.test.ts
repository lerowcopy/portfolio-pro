import { describe, expect, it } from "vitest";
import { editorInvariantOptionLabels, translateEditorValidationMessage } from "./editorValidation";

describe("editor validation localization", () => {
  it("returns the title validation message in both supported UI locales", () => {
    const source = "Название должно содержать минимум 3 символа.";
    expect(translateEditorValidationMessage(source, "ru")).toBe(source);
    expect(translateEditorValidationMessage(source, "en")).toBe("Title must contain at least 3 characters.");
  });

  it("localizes image, social and email validation output", () => {
    expect(translateEditorValidationMessage("Некорректный URL изображения.", "en")).toBe("Invalid image URL.");
    expect(translateEditorValidationMessage("Каждую социальную платформу можно добавить только один раз.", "en")).toBe("Each social platform can only be added once.");
    expect(translateEditorValidationMessage("Введите корректный email.", "en")).toBe("Enter a valid email address.");
  });

  it("keeps font and social-network product names intentionally invariant", () => {
    expect(editorInvariantOptionLabels.fonts).toEqual(["Inter", "Playfair", "Georgia"]);
    expect(editorInvariantOptionLabels.socialPlatforms).toContain("GitHub");
  });
});
