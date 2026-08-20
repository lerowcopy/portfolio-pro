export function portfolioEditorPath(portfolioId: string | number): string {
  const id = String(portfolioId).trim();
  if (!id) {
    throw new Error("Созданное портфолио не вернуло идентификатор.");
  }

  return `/dashboard/portfolios/${encodeURIComponent(id)}/edit`;
}
