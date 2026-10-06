export type ImageExt = 'jpg' | 'png' | 'webp';

export const ALLOWED_MIME: Record<string, ImageExt> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const BLOCKED_EXTENSIONS = /\.(exe|bat|cmd|com|sh|bash|ps1|msi|js|mjs|cjs|jar|php|py|rb|pl|html?|svg|dll|scr|vbs|apk)$/i;

export const isBlockedFilename = (name: string): boolean => BLOCKED_EXTENSIONS.test(name);

/** Detects the real image type from magic bytes, ignoring client-provided MIME. */
export const sniffImage = (buf: Buffer): ImageExt | null => {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  )
    return 'png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP')
    return 'webp';
  return null;
};

/** Returns the validated extension or an error message (Slovak). */
export const validateImage = (
  file: { originalname: string; mimetype: string; buffer: Buffer; size: number },
  maxBytes: number,
): { ok: true; ext: ImageExt } | { ok: false; message: string } => {
  if (isBlockedFilename(file.originalname)) return { ok: false, message: 'Tento typ súboru nie je povolený.' };
  const declared = ALLOWED_MIME[file.mimetype];
  if (!declared) return { ok: false, message: 'Povolené sú len obrázky JPG, PNG alebo WEBP.' };
  if (file.size > maxBytes) return { ok: false, message: 'Súbor je príliš veľký.' };
  const sniffed = sniffImage(file.buffer);
  if (!sniffed || sniffed !== declared) return { ok: false, message: 'Súbor nie je platný obrázok.' };
  return { ok: true, ext: sniffed };
};
