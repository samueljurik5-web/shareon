import { Router } from 'express';
import multer from 'multer';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { badRequest } from '../lib/errors.js';
import { storage } from '../services/storage/index.js';
import { validateImage } from '../services/storage/imageValidation.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_BYTES, files: 1, fields: 0 },
});

/** POST /api/uploads – single image (field "file"). Returns { url }. */
router.post('/', requireAuth, uploadLimiter, upload.single('file'), async (req, res) => {
  if (!req.file) throw badRequest('Vyber obrázok na nahratie.');
  const result = validateImage(req.file, env.UPLOAD_MAX_BYTES);
  if (!result.ok) throw badRequest(result.message);
  const stored = await storage.save(req.file.buffer, result.ext);
  res.status(201).json(stored);
});

export default router;
