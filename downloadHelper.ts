import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export interface ExportFileOptions {
  fileName: string;
  title: string;
  dataUrl?: string; // base64 data: URL
  blob?: Blob;
  mimeType: string;
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
 * Guarda o comparte un archivo (imagen, PDF, JSON, etc.) de forma compatible
 * tanto con navegadores web como con la app nativa APK Android.
 */
export async function downloadOrShareFile(options: ExportFileOptions): Promise<boolean> {
  const { fileName, title, dataUrl, blob: inputBlob, mimeType } = options;

  let blob = inputBlob;
  let base64Pure = '';

  if (dataUrl) {
    if (!blob) {
      blob = dataUrlToBlob(dataUrl);
    }
    const parts = dataUrl.split(',');
    base64Pure = parts[1] || '';
  } else if (blob) {
    base64Pure = await blobToBase64Data(blob);
  }

  const isNative = Capacitor.isNativePlatform();

  // 1. Si estamos en APK nativo (Capacitor), usar Filesystem + Share de Capacitor
  if (isNative) {
    try {
      // Guardar temporalmente en el directorio de caché del dispositivo
      const writeResult = await Filesystem.writeFile({
        path: fileName,
        data: base64Pure,
        directory: Directory.Cache
      });

      // Abrir el diálogo nativo de Android (Compartir en WhatsApp, Guardar en Descargas, etc.)
      await Share.share({
        title: title || fileName,
        text: title,
        url: writeResult.uri,
        dialogTitle: `Guardar o Compartir ${fileName}`
      });

      return true;
    } catch (err: any) {
      console.warn("Capacitor Filesystem/Share error, probando alternativas:", err);
    }
  }

  // 2. Si el navegador soporta Web Share API con archivos (Chrome Android, etc.)
  if (blob && navigator.canShare && typeof File !== 'undefined') {
    try {
      const file = new File([blob], fileName, { type: mimeType });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: title || fileName
        });
        return true;
      }
    } catch (err: any) {
      // Si el usuario canceló el diálogo de compartir, no es un error real
      if (err.name === 'AbortError') return true;
      console.warn("navigator.share error, intentando descarga directa:", err);
    }
  }

  // 3. Método clásico de navegador web (enlace <a> con atributo download)
  try {
    const downloadUrl = dataUrl || (blob ? URL.createObjectURL(blob) : null);
    if (!downloadUrl) return false;

    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      if (!dataUrl && downloadUrl.startsWith('blob:')) {
        URL.revokeObjectURL(downloadUrl);
      }
    }, 500);

    return true;
  } catch (err) {
    console.error("Error al descargar archivo:", err);
    return false;
  }
}
