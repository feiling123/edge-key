export function formatRichContent(value: string, emptyText = "") {
  const trimmed = value.trim();
  if (!trimmed) {
    return emptyText ? `<p>${escapeHtml(emptyText)}</p>` : "";
  }

  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return trimmed;
  }

  return `<p>${escapeHtml(trimmed).replace(/\r?\n/g, "<br>")}</p>`;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
