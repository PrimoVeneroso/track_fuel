import { Capacitor, registerPlugin } from '@capacitor/core';

export type ExportResult = 'saved' | 'started' | 'cancelled' | 'failed';
const BackupExport = registerPlugin<{
  save(options: { filename: string; content: string; mimeType: string }): Promise<{ status: 'saved' | 'cancelled' }>;
}>('BackupExport');

export const triggerFileDownloadOrShare = createFileExporter({
  getPlatform: () => Capacitor.getPlatform(),
  save: options => BackupExport.save(options),
});

// Adapter isolato per verificare salvataggio asincrono, errori e annullamento.
export function createFileExporter(native: {
  getPlatform(): string;
  save(options: { filename: string; content: string; mimeType: string }): Promise<{ status: 'saved' | 'cancelled' }>;
}) {
  return async (blob: Blob, filename: string): Promise<ExportResult> => {
    try {
      if (native.getPlatform() === 'android') {
        const result = await native.save({
          filename,
          content: new TextDecoder('utf-8', { ignoreBOM: true }).decode(await blob.arrayBuffer()),
          mimeType: blob.type.split(';')[0],
        });
        return result.status;
      }
      const file = new File([blob], filename, { type: blob.type });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: filename });
          return 'started';
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
        }
      }
      triggerLegacyDownload(blob, filename);
      return 'started';
    } catch {
      return 'failed';
    }
  };
}

function triggerLegacyDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  try { a.click(); } finally {
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}
