import multer from 'multer';
import { config } from '../config/index.js';

// Memory storage allows cryptographic hashing and signature validation prior to persisting to disk
const storage = multer.memoryStorage();

export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: config.MAX_FILE_SIZE_BYTES, // 10MB
    files: 1
  }
});
