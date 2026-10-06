import { Router } from 'express';
import { param } from '../lib/params.js';
import { z } from 'zod';
import { parseBody } from '../middleware/validate.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { uploadedImageUrl } from '../lib/validation.js';
import { toCents } from '../lib/money.js';
import { badRequest } from '../lib/errors.js';
import { storage } from '../services/storage/index.js';
import { addEvidence, createReport, loadReportForUser, serializeReport } from '../services/reports.js';
import { reportSchema } from './rentals.js';

const router = Router();
router.use(requireAuth);

router.post('/', async (req, res) => {
  const user = currentUser(req);
  const data = parseBody(reportSchema.extend({ rentalRequestId: z.string().min(1).max(64) }), req);
  for (const url of data.photos) if (!(await storage.exists(url))) throw badRequest('Niektorá z fotografií neexistuje.');
  const report = await createReport(user, {
    rentalRequestId: data.rentalRequestId,
    type: data.type,
    description: data.description,
    requestedAmountCents: toCents(data.requestedAmount),
    photos: data.photos,
  });
  res.status(201).json({ report: { id: report.id, status: report.status } });
});

router.get('/:id', async (req, res) => {
  const user = currentUser(req);
  const { report, isAdmin } = await loadReportForUser(param(req, 'id'), user);
  res.json({ report: serializeReport(report, isAdmin, user.id) });
});

const evidenceSchema = z.object({
  text: z.string().trim().max(2000, 'Text je príliš dlhý.').optional().nullable(),
  fileUrl: uploadedImageUrl.optional().nullable(),
});

const handle = (kind: 'EVIDENCE' | 'RESPONSE') => async (req: import('express').Request, res: import('express').Response) => {
  const user = currentUser(req);
  const data = parseBody(evidenceSchema, req);
  if (data.fileUrl && !(await storage.exists(data.fileUrl))) throw badRequest('Fotografia neexistuje.');
  const evidence = await addEvidence(user, param(req, 'id'), data, kind);
  res.status(201).json({ evidence });
};

router.post('/:id/evidence', handle('EVIDENCE'));
router.post('/:id/response', handle('RESPONSE'));

export default router;
