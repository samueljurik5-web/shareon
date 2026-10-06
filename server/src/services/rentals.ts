import type { HandoverMethod, Prisma, RentalRequest, RentalStatus, User } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { parseDateOnly, todayUtc, toDateOnlyString } from '../lib/dates.js';
import { getSettings } from './settings.js';
import { calculatePrice, loadRiskSignals } from './pricing.js';
import { getProtectionProvider } from './protection/index.js';
import { createDepositForRental, tryTransitionDeposit } from './deposit/index.js';
import { notify } from './notifications.js';
import { BLOCKING_RENTAL_STATUSES } from './items.js';

type Tx = Prisma.TransactionClient;

export const MAX_RENTAL_DAYS = 30;

/** Statuses in which contact details (phone, e-mail) are shared between the parties. */
export const CONTACT_VISIBLE_STATUSES: RentalStatus[] = [
  'ACCEPTED',
  'ACTIVE',
  'RETURN_PENDING',
  'RETURNED',
  'DISPUTED',
  'COMPLETED',
];

export const partyRole = (rental: Pick<RentalRequest, 'ownerId' | 'renterId'>, userId: string) =>
  rental.ownerId === userId ? 'OWNER' : rental.renterId === userId ? 'RENTER' : null;

export const loadRentalForParty = async (id: string, user: User) => {
  const rental = await prisma.rentalRequest.findUnique({ where: { id } });
  if (!rental) throw notFound('Žiadosť sa nenašla.');
  const role = partyRole(rental, user.id);
  if (!role && user.role !== 'ADMIN') throw forbidden('Táto žiadosť ti nepatrí.');
  return { rental, role };
};

/** Validates dates against item availability and overlapping rentals. */
export const validateRentalDates = async (
  item: { id: string; availableFrom: Date; availableTo: Date },
  start: Date,
  end: Date,
  excludeRentalId?: string,
  tx: Tx = prisma,
) => {
  if (end < start) throw badRequest('Dátum vrátenia musí byť po dátume začiatku.');
  if (start < todayUtc()) throw badRequest('Začiatok prenájmu nemôže byť v minulosti.');
  const days = Math.round((end.getTime() - start.getTime()) / 86400000);
  if (days > MAX_RENTAL_DAYS) throw badRequest(`Prenájom môže trvať najviac ${MAX_RENTAL_DAYS} dní.`);
  if (start < item.availableFrom || end > item.availableTo) {
    throw badRequest(
      `Predmet je dostupný len od ${toDateOnlyString(item.availableFrom)} do ${toDateOnlyString(item.availableTo)}.`,
    );
  }
  const overlap = await tx.rentalRequest.count({
    where: {
      itemId: item.id,
      id: excludeRentalId ? { not: excludeRentalId } : undefined,
      status: { in: [...BLOCKING_RENTAL_STATUSES] },
      startDate: { lte: end },
      endDate: { gte: start },
    },
  });
  if (overlap > 0) throw conflict('Predmet je v tomto termíne už požičaný.');
};

export interface CreateRentalInput {
  itemId: string;
  startDate: string;
  endDate: string;
  message?: string | null;
  handoverMethod: HandoverMethod;
  acceptRules: true;
  acceptProtectionDisclaimer?: boolean;
}

export const createRentalRequest = async (renter: User, input: CreateRentalInput) => {
  const item = await prisma.item.findUnique({ where: { id: input.itemId }, include: { owner: true } });
  if (!item || !item.isActive || !item.owner.isActive) throw notFound('Predmet sa nenašiel alebo nie je dostupný.');
  if (item.ownerId === renter.id) throw badRequest('Nemôžeš si požičať vlastný predmet.');

  const start = parseDateOnly(input.startDate);
  const end = parseDateOnly(input.endDate);
  await validateRentalDates(item, start, end);

  const duplicate = await prisma.rentalRequest.count({
    where: { itemId: item.id, renterId: renter.id, status: 'PENDING' },
  });
  if (duplicate > 0) throw conflict('Na tento predmet už máš čakajúcu žiadosť.');

  const settings = await getSettings();
  const price = await calculatePrice(item, start, end, settings, await loadRiskSignals(renter.id, item.ownerId));
  if (price.protectionFeeCents > 0 && !input.acceptProtectionDisclaimer) {
    throw badRequest('Potvrď, že rozumieš, že Ochrana prenájmu nie je poistenie.');
  }

  const rental = await prisma.$transaction(async (tx) => {
    const created = await tx.rentalRequest.create({
      data: {
        itemId: item.id,
        renterId: renter.id,
        ownerId: item.ownerId,
        startDate: start,
        endDate: end,
        rentalDays: price.rentalDays,
        message: input.message ?? null,
        handoverMethod: input.handoverMethod,
        pricePerDayCents: price.pricePerDayCents,
        rentalPriceCents: price.rentalPriceCents,
        protectionFeeCents: price.protectionFeeCents,
        depositCents: price.depositCents,
        platformFeeCents: price.platformFeeCents,
        totalCents: price.totalCents,
        protectionMode: price.protectionMode,
        rulesAcceptedAt: new Date(),
        protectionDisclaimerAcceptedAt: input.acceptProtectionDisclaimer ? new Date() : null,
      },
    });
    if (price.protection?.available) {
      await tx.protectionQuote.create({
        data: {
          itemId: item.id,
          rentalRequestId: created.id,
          userId: renter.id,
          provider: price.protection.provider,
          mode: price.protection.mode,
          isDemo: price.protection.isDemo,
          replacementValueCents: item.replacementValueCents,
          protectedValueCents: price.protection.protectedValueCents,
          rentalDays: price.rentalDays,
          feeCents: price.protection.feeCents,
          inputs: price.protection.breakdown,
          expiresAt: new Date(Date.now() + 7 * 86400000),
        },
      });
    }
    await notify(
      item.ownerId,
      {
        type: 'RENTAL_REQUESTED',
        title: `Nová žiadosť o požičanie: ${item.title}`,
        body: `${renter.name} si chce požičať predmet ${toDateOnlyString(start)} – ${toDateOnlyString(end)}.`,
        link: `/requests/${created.id}`,
      },
      tx,
    );
    return created;
  });
  return rental;
};

/** Side effects when a rental becomes ACCEPTED: protection record + simulated deposit hold. */
const onAccepted = async (rental: RentalRequest, tx: Tx) => {
  if (rental.protectionFeeCents > 0) {
    await createProtectionForRental(rental, tx);
  }
  await createDepositForRental(rental, tx);
};

export const createProtectionForRental = async (rental: RentalRequest, tx: Tx = prisma) => {
  const existing = await tx.protectionRecord.findUnique({ where: { rentalRequestId: rental.id } });
  if (existing) return existing;
  if (rental.protectionFeeCents <= 0) throw badRequest('Pre tento prenájom nie je ochrana dostupná.');
  const quote = await tx.protectionQuote.findFirst({
    where: { rentalRequestId: rental.id },
    orderBy: { createdAt: 'desc' },
  });
  const settings = await getSettings();
  const provider = getProtectionProvider(settings);
  // Use the fee snapshot agreed in the request – never re-price after the renter accepted it.
  const record = await provider.createProtection({
    rentalRequestId: rental.id,
    idempotencyKey: `rental:${rental.id}:protection`,
    quote: {
      provider: quote?.provider ?? provider.name,
      mode: rental.protectionMode,
      isDemo: quote?.isDemo ?? true,
      isInsurance: false,
      available: true,
      feeCents: rental.protectionFeeCents,
      protectedValueCents: quote?.protectedValueCents ?? 0,
      breakdown: {},
      disclaimer: '',
    },
  });
  return record;
};

const cancelSideEffects = async (rental: RentalRequest, tx: Tx) => {
  await tx.protectionRecord.updateMany({
    where: { rentalRequestId: rental.id, status: { in: ['QUOTED', 'ACTIVE'] } },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  });
  await tryTransitionDeposit(rental.id, 'RELEASED', tx);
};

export type RentalAction =
  | { action: 'ACCEPT'; note?: string }
  | { action: 'REJECT'; note?: string }
  | { action: 'PROPOSE_DATES'; startDate: string; endDate: string; note?: string }
  | { action: 'ACCEPT_PROPOSAL' }
  | { action: 'DECLINE_PROPOSAL' }
  | { action: 'CANCEL'; note?: string }
  | { action: 'COMPLETE' };

/** Which actions the given party may perform right now (used by UI and enforced server-side). */
export const availableActions = (rental: RentalRequest, role: 'OWNER' | 'RENTER' | null): string[] => {
  const a: string[] = [];
  if (!role) return a;
  const s = rental.status;
  if (s === 'PENDING') {
    if (role === 'OWNER') a.push('ACCEPT', 'REJECT', 'PROPOSE_DATES');
    if (role === 'RENTER') {
      a.push('CANCEL');
      if (rental.proposedStartDate) a.push('ACCEPT_PROPOSAL', 'DECLINE_PROPOSAL');
    }
  }
  if (s === 'ACCEPTED') a.push('CANCEL', 'HANDOVER');
  if (s === 'ACTIVE' || s === 'RETURN_PENDING') a.push('RETURN');
  if (s === 'DISPUTED' && !rental.returnedAt) a.push('RETURN');
  if (s === 'RETURNED' && role === 'OWNER') a.push('COMPLETE');
  if (['ACCEPTED', 'ACTIVE', 'RETURN_PENDING', 'RETURNED', 'DISPUTED', 'COMPLETED'].includes(s)) a.push('REPORT');
  if (s === 'COMPLETED') a.push('REVIEW');
  return a;
};

const assertAction = (rental: RentalRequest, role: 'OWNER' | 'RENTER' | null, action: string) => {
  if (!availableActions(rental, role).includes(action)) {
    throw conflict('Túto akciu nie je možné v aktuálnom stave žiadosti vykonať.');
  }
};

/** Row lock on the item so two overlapping acceptances cannot race. */
const lockItem = (tx: Tx, itemId: string) => tx.$executeRaw`SELECT 1 FROM "Item" WHERE id = ${itemId} FOR UPDATE`;

/** Status change with optimistic locking on the previous status. */
const setStatus = async (tx: Tx, rental: RentalRequest, data: Prisma.RentalRequestUpdateManyMutationInput) => {
  const res = await tx.rentalRequest.updateMany({ where: { id: rental.id, status: rental.status }, data });
  if (res.count === 0) throw conflict('Žiadosť bola medzitým zmenená. Obnov stránku.');
  return tx.rentalRequest.findUniqueOrThrow({ where: { id: rental.id } });
};

export const changeRentalStatus = async (user: User, rentalId: string, input: RentalAction) => {
  const { rental } = await loadRentalForParty(rentalId, user);
  const role = partyRole(rental, user.id);
  assertAction(rental, role, input.action);
  const counterpart = role === 'OWNER' ? rental.renterId : rental.ownerId;
  const item = await prisma.item.findUniqueOrThrow({ where: { id: rental.itemId } });
  const link = `/requests/${rental.id}`;

  return prisma.$transaction(async (tx) => {
    switch (input.action) {
      case 'ACCEPT': {
        await lockItem(tx, item.id);
        await validateRentalDates(item, rental.startDate, rental.endDate, rental.id, tx);
        const updated = await setStatus(tx, rental, {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          ownerNote: input.note ?? rental.ownerNote,
          proposedStartDate: null,
          proposedEndDate: null,
        });
        await onAccepted(updated, tx);
        await notify(counterpart, { type: 'RENTAL_ACCEPTED', title: `Žiadosť prijatá: ${item.title}`, link }, tx);
        return updated;
      }
      case 'REJECT': {
        const updated = await setStatus(tx, rental, { status: 'REJECTED', rejectedAt: new Date(), ownerNote: input.note ?? null });
        await notify(counterpart, { type: 'RENTAL_REJECTED', title: `Žiadosť zamietnutá: ${item.title}`, link }, tx);
        return updated;
      }
      case 'PROPOSE_DATES': {
        const start = parseDateOnly(input.startDate);
        const end = parseDateOnly(input.endDate);
        await validateRentalDates(item, start, end, rental.id, tx);
        const updated = await setStatus(tx, rental, {
          proposedStartDate: start,
          proposedEndDate: end,
          ownerNote: input.note ?? null,
        });
        await notify(
          counterpart,
          {
            type: 'RENTAL_DATES_PROPOSED',
            title: `Majiteľ navrhol iný termín: ${item.title}`,
            body: `${input.startDate} – ${input.endDate}`,
            link,
          },
          tx,
        );
        return updated;
      }
      case 'ACCEPT_PROPOSAL': {
        const start = rental.proposedStartDate!;
        const end = rental.proposedEndDate!;
        await lockItem(tx, item.id);
        await validateRentalDates(item, start, end, rental.id, tx);
        // Re-price server-side for the new dates.
        const settings = await getSettings();
        const price = await calculatePrice(item, start, end, settings, await loadRiskSignals(rental.renterId, rental.ownerId));
        const updated = await setStatus(tx, rental, {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          startDate: start,
          endDate: end,
          rentalDays: price.rentalDays,
          pricePerDayCents: price.pricePerDayCents,
          rentalPriceCents: price.rentalPriceCents,
          // Keep protection only if the renter agreed to the disclaimer earlier.
          protectionFeeCents: rental.protectionDisclaimerAcceptedAt ? price.protectionFeeCents : 0,
          depositCents: price.depositCents,
          platformFeeCents: price.platformFeeCents,
          totalCents:
            price.totalCents - (rental.protectionDisclaimerAcceptedAt ? 0 : price.protectionFeeCents),
          proposedStartDate: null,
          proposedEndDate: null,
        });
        if (price.protection?.available && rental.protectionDisclaimerAcceptedAt) {
          await tx.protectionQuote.create({
            data: {
              itemId: item.id,
              rentalRequestId: rental.id,
              userId: rental.renterId,
              provider: price.protection.provider,
              mode: price.protection.mode,
              isDemo: price.protection.isDemo,
              replacementValueCents: item.replacementValueCents,
              protectedValueCents: price.protection.protectedValueCents,
              rentalDays: price.rentalDays,
              feeCents: price.protection.feeCents,
              inputs: price.protection.breakdown,
              expiresAt: new Date(Date.now() + 7 * 86400000),
            },
          });
        }
        await onAccepted(updated, tx);
        await notify(counterpart, { type: 'RENTAL_ACCEPTED', title: `Nájomca prijal nový termín: ${item.title}`, link }, tx);
        return updated;
      }
      case 'DECLINE_PROPOSAL': {
        const updated = await setStatus(tx, rental, { proposedStartDate: null, proposedEndDate: null });
        await notify(counterpart, { type: 'RENTAL_PROPOSAL_DECLINED', title: `Navrhnutý termín odmietnutý: ${item.title}`, link }, tx);
        return updated;
      }
      case 'CANCEL': {
        const updated = await setStatus(tx, rental, {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledById: user.id,
          ownerNote: role === 'OWNER' ? (input.note ?? rental.ownerNote) : rental.ownerNote,
        });
        await cancelSideEffects(updated, tx);
        await notify(counterpart, { type: 'RENTAL_CANCELLED', title: `Prenájom zrušený: ${item.title}`, link }, tx);
        return updated;
      }
      case 'COMPLETE': {
        const updated = await setStatus(tx, rental, { status: 'COMPLETED', completedAt: new Date() });
        await tryTransitionDeposit(rental.id, 'RELEASED', tx);
        await tx.protectionRecord.updateMany({ where: { rentalRequestId: rental.id, status: 'ACTIVE' }, data: { status: 'EXPIRED' } });
        await notify(counterpart, { type: 'RENTAL_COMPLETED', title: `Prenájom dokončený: ${item.title}`, body: 'Teraz môžeš ohodnotiť druhú stranu.', link }, tx);
        return updated;
      }
    }
  });
};

export interface ChecklistInput {
  note?: string | null;
  photos: string[];
  itemOk?: boolean;
}

/** Handover checklist: owner confirms handover (condition photos), renter confirms receipt. Both → ACTIVE. */
export const confirmHandover = async (user: User, rentalId: string, input: ChecklistInput) => {
  const { rental } = await loadRentalForParty(rentalId, user);
  const role = partyRole(rental, user.id);
  assertAction(rental, role, 'HANDOVER');
  return prisma.$transaction(async (tx) => {
    const exists = await tx.handoverRecord.findUnique({
      where: { rentalRequestId_type_partyRole: { rentalRequestId: rental.id, type: 'HANDOVER', partyRole: role! } },
    });
    if (exists) throw conflict('Odovzdanie si už potvrdil.');
    await tx.handoverRecord.create({
      data: {
        rentalRequestId: rental.id,
        type: 'HANDOVER',
        userId: user.id,
        partyRole: role!,
        note: input.note ?? null,
        photos: { create: input.photos.map((url) => ({ url })) },
      },
    });
    const count = await tx.handoverRecord.count({ where: { rentalRequestId: rental.id, type: 'HANDOVER' } });
    const counterpart = role === 'OWNER' ? rental.renterId : rental.ownerId;
    if (count === 2) {
      const updated = await setStatus(tx, rental, { status: 'ACTIVE', activeAt: new Date() });
      await notify(counterpart, { type: 'RENTAL_ACTIVE', title: 'Odovzdanie potvrdené oboma stranami. Prenájom beží.', link: `/requests/${rental.id}` }, tx);
      return updated;
    }
    await notify(
      counterpart,
      {
        type: 'HANDOVER_CONFIRMED',
        title: role === 'OWNER' ? 'Majiteľ potvrdil odovzdanie predmetu' : 'Nájomca potvrdil prevzatie predmetu',
        body: 'Potvrď to aj ty.',
        link: `/requests/${rental.id}`,
      },
      tx,
    );
    return rental;
  });
};

/** Return checklist: both confirm. If owner marks item OK → COMPLETED + deposit released. */
export const confirmReturn = async (user: User, rentalId: string, input: ChecklistInput) => {
  const { rental } = await loadRentalForParty(rentalId, user);
  const role = partyRole(rental, user.id);
  assertAction(rental, role, 'RETURN');
  if (role === 'OWNER' && typeof input.itemOk !== 'boolean') {
    throw badRequest('Uveď, či bol predmet vrátený v poriadku.');
  }
  return prisma.$transaction(async (tx) => {
    const exists = await tx.handoverRecord.findUnique({
      where: { rentalRequestId_type_partyRole: { rentalRequestId: rental.id, type: 'RETURN', partyRole: role! } },
    });
    if (exists) throw conflict('Vrátenie si už potvrdil.');
    await tx.handoverRecord.create({
      data: {
        rentalRequestId: rental.id,
        type: 'RETURN',
        userId: user.id,
        partyRole: role!,
        note: input.note ?? null,
        itemOk: role === 'OWNER' ? input.itemOk : null,
        photos: { create: input.photos.map((url) => ({ url })) },
      },
    });
    const records = await tx.handoverRecord.findMany({ where: { rentalRequestId: rental.id, type: 'RETURN' } });
    const counterpart = role === 'OWNER' ? rental.renterId : rental.ownerId;
    const link = `/requests/${rental.id}`;

    if (records.length < 2) {
      const updated =
        rental.status === 'ACTIVE' ? await setStatus(tx, rental, { status: 'RETURN_PENDING' }) : rental;
      await notify(counterpart, { type: 'RETURN_CONFIRMED', title: 'Druhá strana potvrdila vrátenie', body: 'Potvrď vrátenie aj ty.', link }, tx);
      return updated;
    }

    const ownerRecord = records.find((r) => r.partyRole === 'OWNER')!;
    const now = new Date();
    if (rental.status === 'DISPUTED') {
      // Dispute in progress: record the return but keep status; admin decides.
      return setStatus(tx, rental, { returnedAt: now });
    }
    if (ownerRecord.itemOk) {
      const updated = await setStatus(tx, rental, { status: 'COMPLETED', returnedAt: now, completedAt: now });
      await tryTransitionDeposit(rental.id, 'RELEASED', tx);
      await tx.protectionRecord.updateMany({ where: { rentalRequestId: rental.id, status: 'ACTIVE' }, data: { status: 'EXPIRED' } });
      for (const uid of [rental.ownerId, rental.renterId]) {
        await notify(uid, { type: 'RENTAL_COMPLETED', title: 'Prenájom je dokončený', body: 'Ohodnoť druhú stranu.', link }, tx);
      }
      return updated;
    }
    // Owner reported a problem – deposit stays held; owner can open a report or complete later.
    const updated = await setStatus(tx, rental, { status: 'RETURNED', returnedAt: now });
    await notify(counterpart, { type: 'RETURN_ISSUE', title: 'Majiteľ označil, že predmet nebol vrátený v poriadku', link }, tx);
    return updated;
  });
};
