import { describe, expect, it } from "vitest";
import { portfolioEditorPath } from "./portfolioRoutes";

describe("portfolioEditorPath", () => {
  it("создаёт редакторский маршрут для внешнего UUID", () => {
    expect(portfolioEditorPath("f1c862fe-88b9-4aac-9a35-08c8d23b1e67")).toBe(
      "/dashboard/portfolios/f1c862fe-88b9-4aac-9a35-08c8d23b1e67/edit",
    );
  });

  it("сохраняет совместимость с numeric Manus portfolio id", () => {
    expect(portfolioEditorPath(42)).toBe("/dashboard/portfolios/42/edit");
  });

  it("отклоняет пустой идентификатор вместо перехода на несуществующий маршрут", () => {
    expect(() => portfolioEditorPath("  ")).toThrow("не вернуло идентификатор");
  });
});
