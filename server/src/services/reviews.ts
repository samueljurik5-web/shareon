import type { User } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { partyRole } from './rentals.js';
import { notify } from './notifications.js';

export interface UserReviewInput {
  rentalRequestId: string;
  overall: number;
  comment?: string | null;
  punctuality?: number;
  communication?: number;
  reliability?: number;
  respectfulUse?: number;
  onTimeReturn?: number;
}

const loadCompletedRental = async (rentalRequestId: string, user: User) => {
  const rental = await prisma.rentalRequest.findUnique({ where: { id: rentalRequestId } });
  if (!rental) throw notFound('Prenájom sa nenašiel.');
  const role = partyRole(rental, user.id);
  if (!role) throw forbidden('Hodnotiť môžeš len prenájom, ktorého si sa zúčastnil.');
  if (rental.status !== 'COMPLETED') throw conflict('Hodnotiť je možné až po dokončení prenájmu.');
  return { rental, role };
};

export const createUserReview = async (user: User, input: UserReviewInput) => {
  const { rental, role } = await loadCompletedRental(input.rentalRequestId, user);
  const targetId = role === 'OWNER' ? rental.renterId : rental.ownerId;
  if (targetId === user.id) throw badRequest('Nemôžeš hodnotiť sám seba.');
  const type = role === 'OWNER' ? 'OWNER_TO_RENTER' : 'RENTER_TO_OWNER';

  if (role === 'OWNER' && (input.respectfulUse == null || input.onTimeReturn == null || input.communication == null)) {
    throw badRequest('Ohodnoť šetrné zaobchádzanie, včasné vrátenie a komunikáciu.');
  }
  if (role === 'RENTER' && (input.punctuality == null || input.communication == null || input.reliability == null)) {
    throw badRequest('Ohodnoť dochvíľnosť, komunikáciu a spoľahlivosť.');
  }
  const existing = await prisma.review.findUnique({ where: { rentalRequestId_type: { rentalRequestId: rental.id, type } } });
  if (existing) throw conflict('Tento prenájom si už ohodnotil.');

  const review = await prisma.review.create({
    data: {
      rentalRequestId: rental.id,
      authorId: user.id,
      targetId,
      type,
      overall: input.overall,
      comment: input.comment ?? null,
      communication: input.communication,
      punctuality: role === 'RENTER' ? input.punctuality : null,
      reliability: role === 'RENTER' ? input.reliability : null,
      respectfulUse: role === 'OWNER' ? input.respectfulUse : null,
      onTimeReturn: role === 'OWNER' ? input.onTimeReturn : null,
    },
  });
  await notify(targetId, { type: 'REVIEW_RECEIVED', title: 'Dostal si nové hodnotenie', link: `/users/${targetId}` });
  return review;
};

export interface ItemReviewInput {
  rentalRequestId: string;
  descriptionAccuracy: number;
  itemCondition: number;
  valueForMoney: number;
  handoverExperience: number;
  overall: number;
  comment?: string | null;
}

export const createItemReview = async (user: User, input: ItemReviewInput) => {
  const { rental, role } = await loadCompletedRental(input.rentalRequestId, user);
  if (role !== 'RENTER') throw forbidden('Predmet môže hodnotiť len nájomca.');
  const existing = await prisma.itemReview.findUnique({ where: { rentalRequestId: rental.id } });
  if (existing) throw conflict('Tento predmet si už za tento prenájom ohodnotil.');
  return prisma.itemReview.create({
    data: {
      rentalRequestId: rental.id,
      itemId: rental.itemId,
      authorId: user.id,
      descriptionAccuracy: input.descriptionAccuracy,
      itemCondition: input.itemCondition,
      valueForMoney: input.valueForMoney,
      handoverExperience: input.handoverExperience,
      overall: input.overall,
      comment: input.comment ?? null,
    },
  });
};
