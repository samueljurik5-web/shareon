import { Router } from 'express';
import { z } from 'zod';
import { parseBody } from '../middleware/validate.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { rating } from '../lib/validation.js';
import { createItemReview, createUserReview } from '../services/reviews.js';

const router = Router();
router.use(requireAuth);

const comment = z.string().trim().max(1000, 'Komentár je príliš dlhý.').optional().nullable();

const userReviewSchema = z.object({
  rentalRequestId: z.string().min(1).max(64),
  overall: rating('Celkové hodnotenie'),
  comment,
  punctuality: rating('Dochvíľnosť').optional(),
  communication: rating('Komunikácia').optional(),
  reliability: rating('Spoľahlivosť').optional(),
  respectfulUse: rating('Šetrné zaobchádzanie').optional(),
  onTimeReturn: rating('Včasné vrátenie').optional(),
});

router.post('/user', async (req, res) => {
  const review = await createUserReview(currentUser(req), parseBody(userReviewSchema, req));
  res.status(201).json({ review });
});

const itemReviewSchema = z.object({
  rentalRequestId: z.string().min(1).max(64),
  descriptionAccuracy: rating('Presnosť popisu'),
  itemCondition: rating('Stav predmetu'),
  valueForMoney: rating('Pomer cena/výkon'),
  handoverExperience: rating('Odovzdanie'),
  overall: rating('Celkové hodnotenie'),
  comment,
});

router.post('/item', async (req, res) => {
  const review = await createItemReview(currentUser(req), parseBody(itemReviewSchema, req));
  res.status(201).json({ review });
});

export default router;
