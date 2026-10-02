/** Browser save fallback; the native desktop application uses its file dialog. */
export function downloadProject(content: string, projectName: string): void {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${projectName.replace(/[\\/:*?"<>|]/g, '_').trim() || 'Project'}.uml.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Allow the browser to start consuming the Blob before releasing it.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Download a generated SVG string or PNG data URL without a server. */
export function downloadArtifact(data: string, filename: string, mime: string): void {
  const url = mime === 'image/png' ? data : URL.createObjectURL(new Blob([data], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.replace(/[\\/:*?"<>|]/g, '_');
  document.body.appendChild(link);
  link.click();
  link.remove();
  if (url.startsWith('blob:')) window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
