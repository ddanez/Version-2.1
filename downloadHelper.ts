import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export interface ExportFileOptions {
  fileName: string;
  title: string;
  content?: string; // Contenido en texto plano (ej. JSON)
  dataUrl?: string; // base64 data: URL
  blob?: Blob;
  mimeType: string;
  dialogTitle?: string;
  preferShare?: boolean;
}

/**
 * Convierte un Data URL (base64) a Blob
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Convierte un Blob a base64 string (sin prefijo data:)
 */
export async function blobToBase64Data(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const res = reader.result as string;
      const base64 = res.split(',')[1] || res;
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Guarda o comparte un archivo (imagen, PDF, JSON, etc.) de forma 100% compatible
 * tanto con navegadores web como con la app nativa APK Android.
 */
export async function downloadOrShareFile(options: ExportFileOptions): Promise<boolean> {
  const { fileName, title, content, dataUrl, mimeType, dialogTitle, preferShare } = options;
  let blob = options.blob;

  // Si se envió texto plano y no hay blob, crearlo
  if (content && !blob) {
    blob = new Blob([content], { type: mimeType });
  }

  let base64Pure = '';
  if (dataUrl) {
    if (!blob) {
      blob = dataUrlToBlob(dataUrl);
    }
    const parts = dataUrl.split(',');
    base64Pure = parts[1] || '';
  } else if (blob && !content) {
    base64Pure = await blobToBase64Data(blob);
  }

  const isNative = Capacitor.isNativePlatform();

  // 1. Si estamos en APK nativo (Capacitor Android)
  if (isNative) {
    try {
      let fileUri = '';

      // Si es contenido de texto (JSON)
      if (content) {
        const writeResult = await Filesystem.writeFile({
          path: fileName,
          data: content,
          directory: Directory.Cache,
          encoding: Encoding.UTF8
        });
        fileUri = writeResult.uri;

        // Intentar guardar también en Documentos para respaldo persistente
        try {
          await Filesystem.writeFile({
            path: fileName,
            data: content,
            directory: Directory.Documents,
            encoding: Encoding.UTF8
          });
        } catch (docErr) {
          console.warn("No se pudo escribir en Documents, pero sí en Cache:", docErr);
        }
      } else {
        // Si es binario / base64 (imágenes, PDF)
        const writeResult = await Filesystem.writeFile({
          path: fileName,
          data: base64Pure,
          directory: Directory.Cache
        });
        fileUri = writeResult.uri;
      }

      // Abrir el diálogo nativo de compartir de Android (Google Drive, WhatsApp, Guardar en archivos, etc.)
      await Share.share({
        title: title || fileName,
        text: title || 'Copia de seguridad',
        files: [fileUri],
        url: fileUri,
        dialogTitle: dialogTitle || `Guardar o Compartir ${fileName}`
      });

      return true;
    } catch (err: any) {
      console.warn("Capacitor Filesystem/Share error, probando alternativas:", err);
      // Si el usuario simplemente canceló el diálogo nativo de compartir, se considera éxito
      if (err.message && (err.message.includes('canceled') || err.message.includes('dismissed'))) {
        return true;
      }
    }
  }

  // 2. Si se solicitó compartir y el navegador soporta Web Share API con archivos
  if (preferShare && blob && navigator.canShare && typeof File !== 'undefined') {
    try {
      const file = new File([blob], fileName, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: title || fileName,
          text: title
        });
        return true;
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return true;
      console.warn("navigator.share no pudo compartir archivos directamente:", err);
    }
  }

  // 3. Método clásico de navegador web (descarga con <a download>)
  try {
    let downloadUrl: string | null = null;
    if (blob) {
      downloadUrl = URL.createObjectURL(blob);
    } else if (dataUrl) {
      downloadUrl = dataUrl;
    }

    if (!downloadUrl) return false;

    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      if (blob && downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    }, 1000);

    return true;
  } catch (err) {
    console.error("Error al descargar archivo en navegador:", err);
    return false;
  }
}
