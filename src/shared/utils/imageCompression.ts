// Compresión de imágenes en el navegador con Canvas (sin dependencias).
// Reglas del producto: lado más largo ≤ 1600 px, preferentemente WebP con
// calidad 80–85 % y objetivo aproximado de 2 MB por foto.

export const MAX_IMAGE_DIMENSION = 1600;
export const TARGET_MAX_BYTES = 2 * 1024 * 1024;
const PREFERRED_QUALITY = 0.85;
const FALLBACK_QUALITY = 0.8;

export const ACCEPTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface CompressedImage {
  blob: Blob;
  mimeType: string;
  /** Extensión coherente con el MIME final (webp o jpg si el navegador no soporta WebP). */
  extension: string;
}

/** Dimensiones destino manteniendo proporción, con el lado más largo limitado. */
export function fitWithinMaxDimension(
  width: number,
  height: number,
  maxDimension: number = MAX_IMAGE_DIMENSION,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxDimension) return { width, height };
  const scale = maxDimension / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function isAcceptedImageType(mimeType: string): boolean {
  return ACCEPTED_IMAGE_MIME_TYPES.includes(mimeType);
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen.'));
    };
    image.src = url;
  });
}

/**
 * Redimensiona y comprime una imagen antes de subirla. Prefiere WebP; si el
 * navegador no lo soporta, degrada a JPEG. Si con la calidad preferida el
 * resultado supera el objetivo (~2 MB), reintenta con la calidad mínima del
 * rango permitido.
 */
export async function compressImage(file: File): Promise<CompressedImage> {
  if (!isAcceptedImageType(file.type)) {
    throw new Error('Formato de imagen no admitido. Usa JPG, PNG o WebP.');
  }

  const source = await decodeImage(file);
  const sourceWidth = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const sourceHeight = 'naturalHeight' in source ? source.naturalHeight : source.height;
  const { width, height } = fitWithinMaxDimension(sourceWidth, sourceHeight);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('No se pudo preparar la imagen para comprimirla.');
  }
  context.drawImage(source, 0, 0, width, height);
  if ('close' in source) source.close();

  let mimeType = 'image/webp';
  let blob = await canvasToBlob(canvas, mimeType, PREFERRED_QUALITY);
  if (!blob || blob.type !== 'image/webp') {
    // El navegador no soporta WebP: se degrada a JPEG.
    mimeType = 'image/jpeg';
    blob = await canvasToBlob(canvas, mimeType, PREFERRED_QUALITY);
  }
  if (blob && blob.size > TARGET_MAX_BYTES) {
    const smaller = await canvasToBlob(canvas, mimeType, FALLBACK_QUALITY);
    if (smaller && smaller.size < blob.size) blob = smaller;
  }
  if (!blob) {
    throw new Error('No se pudo comprimir la imagen.');
  }

  return {
    blob,
    mimeType,
    extension: mimeType === 'image/webp' ? 'webp' : 'jpg',
  };
}
