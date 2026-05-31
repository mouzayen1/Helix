// Persist an export file — WEB variant. There's no filesystem or OS share
// sheet in the browser, so trigger a standard file download via a Blob and
// a temporary anchor element. Metro resolves this over export-file.ts on
// the web target.

export async function saveExport(
  filename: string,
  content: string,
  mime: string
): Promise<string> {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return filename;
}
