import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config/index.js';

// Resolve absolute storage root
const STORAGE_ROOT = path.resolve(process.cwd(), config.STORAGE_DIR);

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_ROOT)) {
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
}

// Magic bytes table for MIME signature verification
const MAGIC_SIGNATURES: Record<string, number[][]> = {
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]], // %PDF
  'image/png': [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]], // \x89PNG\r\n\x1a\n
  'image/jpeg': [
    [0xff, 0xd8, 0xff, 0xe0],
    [0xff, 0xd8, 0xff, 0xe1],
    [0xff, 0xd8, 0xff, 0xee],
    [0xff, 0xd8, 0xff, 0xdb]
  ],
  'image/gif': [
    [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
    [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]  // GIF89a
  ]
};

// Allowed file extensions
const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.png', '.jpg', '.jpeg', '.gif',
  '.txt', '.csv', '.json', '.docx', '.xlsx', '.md'
]);

// Dangerous extensions strictly blocked regardless of declared MIME
const DANGEROUS_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.bash', '.vbs', '.js',
  '.ts', '.php', '.phtml', '.py', '.rb', '.pl', '.jar',
  '.war', '.dll', '.so', '.scr', '.msi', '.ps1', '.hta'
]);

export function validateFileSafety(originalName: string, buffer: Buffer, declaredMimeType: string): void {
  // 1. Sanitize and inspect extension
  const sanitizedName = path.basename(originalName);
  const ext = path.extname(sanitizedName).toLowerCase();

  if (DANGEROUS_EXTENSIONS.has(ext)) {
    const error: any = new Error(`Dangerous file extension '${ext}' is strictly prohibited.`);
    error.statusCode = 400;
    throw error;
  }

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    const error: any = new Error(`File extension '${ext}' is not supported. Allowed extensions: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`);
    error.statusCode = 400;
    throw error;
  }

  // 2. Magic byte inspection if signature rule exists
  const signatures = MAGIC_SIGNATURES[declaredMimeType];
  if (signatures && buffer.length >= 4) {
    const matchesSignature = signatures.some((sig) => {
      for (let i = 0; i < sig.length; i++) {
        if (buffer[i] !== sig[i]) return false;
      }
      return true;
    });

    if (!matchesSignature) {
      const error: any = new Error(`File signature mismatch: contents do not match declared MIME type '${declaredMimeType}'.`);
      error.statusCode = 400;
      throw error;
    }
  }
}

export function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function saveFile(buffer: Buffer, originalName: string): Promise<{ storageFilename: string; absolutePath: string; checksum: string }> {
  const ext = path.extname(path.basename(originalName)).toLowerCase();
  const storageFilename = `${crypto.randomUUID()}${ext}`;
  const absolutePath = path.resolve(STORAGE_ROOT, storageFilename);

  // Path traversal check
  if (!absolutePath.startsWith(STORAGE_ROOT)) {
    const error: any = new Error('Invalid file path traversal attempt detected.');
    error.statusCode = 400;
    throw error;
  }

  await fs.promises.writeFile(absolutePath, buffer);
  const checksum = computeSha256(buffer);

  return { storageFilename, absolutePath, checksum };
}

export function getFileReadStream(storageFilename: string): fs.ReadStream {
  const safeFilename = path.basename(storageFilename);
  const absolutePath = path.resolve(STORAGE_ROOT, safeFilename);

  if (!absolutePath.startsWith(STORAGE_ROOT) || !fs.existsSync(absolutePath)) {
    const error: any = new Error('Requested file not found on disk.');
    error.statusCode = 404;
    throw error;
  }

  return fs.createReadStream(absolutePath);
}

export async function deleteStoredFile(storageFilename: string): Promise<void> {
  const safeFilename = path.basename(storageFilename);
  const absolutePath = path.resolve(STORAGE_ROOT, safeFilename);

  if (absolutePath.startsWith(STORAGE_ROOT) && fs.existsSync(absolutePath)) {
    try {
      await fs.promises.unlink(absolutePath);
    } catch (e) {
      console.warn(`Failed to unlink file ${absolutePath}:`, e);
    }
  }
}
