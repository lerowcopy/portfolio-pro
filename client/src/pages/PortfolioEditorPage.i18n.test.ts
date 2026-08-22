import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("PortfolioEditorPage localization", () => {
  it("uses translation keys for editor actions, sections, upload and publishing controls", () => {
    const source = readFileSync(new URL("./PortfolioEditorPage.tsx", import.meta.url), "utf8");

    expect(source).toContain('t("editor.profileTitle")');
    expect(source).toContain('t("editor.publicUrl")');
    expect(source).toContain('t("editor.artDirection")');
    expect(source).toContain('t("editor.socialLinks")');
    expect(source).toContain('t("editor.publish")');
    expect(source).toContain('t("editor.upload")');
    expect(source).toContain('t("editor.completeUpload")');
    expect(source).toContain('t("editor.save")');
    expect(source).toContain('t("editor.templateMinimal")');
    expect(source).toContain('translateEditorValidationMessage(');
    expect(source).toContain('import { translateEditorValidationMessage }');
  });
});
