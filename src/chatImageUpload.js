const CHAT_IMAGE_TARGET_BYTES = 2 * 1024 * 1024;
const CHAT_IMAGE_MAX_EDGE = 1920;
const CHAT_IMAGE_QUALITY = 0.82;

export function shouldOptimizeChatImage(file) {
  if (!file?.type?.startsWith('image/')) return false;
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return false;
  return Number(file.size || 0) > CHAT_IMAGE_TARGET_BYTES;
}

function optimizedFileName(name = 'chat-photo') {
  const stem = String(name || 'chat-photo').replace(/\.[^.]+$/, '').slice(0, 100) || 'chat-photo';
  return `${stem}.webp`;
}

async function imageBitmapFromFile(file) {
  if (typeof createImageBitmap === 'function') return createImageBitmap(file, { imageOrientation: 'from-image' });
  if (typeof document === 'undefined' || typeof URL === 'undefined') throw new Error('image decoding unavailable');

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const node = new Image();
      node.onload = () => resolve(node);
      node.onerror = () => reject(new Error('image decoding failed'));
      node.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function outputDimensions(width, height) {
  const largest = Math.max(width, height);
  if (!largest || largest <= CHAT_IMAGE_MAX_EDGE) return { width, height };
  const scale = CHAT_IMAGE_MAX_EDGE / largest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasBlob(canvas, type, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality));
}

export async function prepareChatUploadFile(file) {
  if (!shouldOptimizeChatImage(file)) return file;
  if (typeof document === 'undefined') return file;

  let source;
  try {
    source = await imageBitmapFromFile(file);
    const width = Number(source.width || source.naturalWidth || 0);
    const height = Number(source.height || source.naturalHeight || 0);
    if (!width || !height) return file;

    const size = outputDimensions(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return file;
    context.drawImage(source, 0, 0, size.width, size.height);

    const blob = await canvasBlob(canvas, 'image/webp', CHAT_IMAGE_QUALITY);
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], optimizedFileName(file.name), {
      type: blob.type || 'image/webp',
      lastModified: file.lastModified || Date.now(),
    });
  } catch {
    return file;
  } finally {
    source?.close?.();
  }
}

export const CHAT_IMAGE_POLICY = Object.freeze({
  targetBytes: CHAT_IMAGE_TARGET_BYTES,
  maxEdge: CHAT_IMAGE_MAX_EDGE,
  quality: CHAT_IMAGE_QUALITY,
});
