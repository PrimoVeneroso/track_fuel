export function triggerFileDownloadOrShare(blob: Blob, filename: string): boolean {
  try {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({
        files: [file],
        title: filename,
      }).catch((e) => {
        // Fallback per sicurezza
        if (e.name !== 'AbortError') {
          triggerLegacyDownload(blob, filename);
        }
      });
      return true;
    }
  } catch (e) {
    // ignore
  }

  triggerLegacyDownload(blob, filename);
  return true;
}

function triggerLegacyDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
