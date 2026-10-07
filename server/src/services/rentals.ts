import type { HandoverMethod, Item, Prisma, RentalMode, RentalRequest, RentalStatus, User } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { getSettings } from './settings.js';
import { calculateRentalPrice, loadRiskSignals } from './pricing.js';
import type { PriceBreakdown } from './pricing.js';
import { getProtectionProvider } from './protection/index.js';
import { createDepositForRental, tryTransitionDeposit } from './deposit/index.js';
import { notify } from './notifications.js';
import { checkItemAvailability, resolvePeriod } from './availability.js';
import type { ResolvedPeriod } from './availability.js';
import { describePeriod } from './periodText.js';

type Tx = Prisma.TransactionClient;

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

/** Period stored on a rental → ResolvedPeriod (for re-validation on acceptance). */
export const periodOfRental = (r: Pick<RentalRequest, 'rentalMode' | 'startDate' | 'endDate' | 'startTime' | 'endTime'>) =>
  resolvePeriod({
    rentalMode: r.rentalMode,
    startDate: r.startDate.toISOString().slice(0, 10),
    endDate: r.endDate.toISOString().slice(0, 10),
    startTime: r.startTime,
    endTime: r.endTime,
  });

/** DB fields describing the period + server-calculated price snapshot. */
const periodAndPriceData = (period: ResolvedPeriod, price: PriceBreakdown, withProtection: boolean) => {
  const protectionFeeCents = withProtection ? price.protectionFeeCents : 0;
  return {
    rentalMode: period.mode,
    startDate: new Date(`${period.startDate}T00:00:00Z`),
    endDate: new Date(`${period.endDate}T00:00:00Z`),
    startTime: period.startTime,
    endTime: period.endTime,
    startAt: period.startAt,
    endAt: period.endAt,
    durationMinutes: price.durationMinutes,
    durationDays: price.durationDays,
    pricePerUnitCents: price.pricePerUnitCents,
    rentalPriceCents: price.rentalPriceCents,
    protectionFeeCents,
    depositCents: price.depositCents,
    platformFeeCents: price.platformFeeCents,
    totalCents: price.totalCents - (price.protectionFeeCents - protectionFeeCents),
    refundableCents: price.refundableCents,
  };
};

/** Persists the protection quote used for a request/estimate (audit trail of the fee). */
export const saveProtectionQuote = (
  tx: Tx,
  data: { itemId: string; rentalRequestId?: string | null; userId?: string | null; replacementValueCents: number; price: PriceBreakdown; ttlMs?: number },
) => {
  const q = data.price.protection;
  if (!q?.available) return null;
  return tx.protectionQuote.create({
    data: {
      itemId: data.itemId,
      rentalRequestId: data.rentalRequestId ?? null,
      userId: data.userId ?? null,
      provider: q.provider,
      mode: q.mode,
      isDemo: q.isDemo,
      replacementValueCents: data.replacementValueCents,
      protectedValueCents: q.protectedValueCents,
      rentalMode: data.price.rentalMode,
      rentalDays: data.price.durationDays,
      durationMinutes: data.price.durationMinutes,
      feeCents: q.feeCents,
      inputs: q.breakdown,
      expiresAt: new Date(Date.now() + (data.ttlMs ?? 7 * 86400000)),
    },
  });
};

/**
 * Validates a requested period for an item and returns the full server-side quote.
 * Used by POST /api/pricing/quote (no side effects) and by rental creation.
 */
export const quoteRental = async (
  item: Item & { owner?: { isActive: boolean } | null },
  input: { rentalMode: RentalMode; startDate: string; endDate?: string | null; startTime?: string | null; endTime?: string | null },
  renterId: string | null,
  opts: { excludeRentalId?: string; tx?: Tx } = {},
) => {
  const period = resolvePeriod(input);
  await checkItemAvailability(item, period, { ...opts, ownerActive: item.owner?.isActive });
  const settings = await getSettings();
  const price = await calculateRentalPrice(item, period.duration, settings, await loadRiskSignals(renterId, item.ownerId));
  return { period, price };
};

export interface CreateRentalInput {
  itemId: string;
  rentalMode: RentalMode;
  startDate: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  message?: string | null;
  handoverMethod: HandoverMethod;
  acceptRules: true;
  acceptProtectionDisclaimer?: boolean;
}

export const createRentalRequest = async (renter: User, input: CreateRentalInput) => {
  const item = await prisma.item.findUnique({ where: { id: input.itemId }, include: { owner: true } });
  if (!item || !item.isActive || !item.owner.isActive) throw notFound('Predmet sa nenašiel alebo nie je dostupný.');
  if (item.ownerId === renter.id) throw badRequest('Nemôžeš si požičať vlastný predmet.');

  // Everything (availability, duration, price, fees) is recalculated here – client values are ignored.
  const { period, price } = await quoteRental(item, input, renter.id);

  const duplicate = await prisma.rentalRequest.count({
    where: { itemId: item.id, renterId: renter.id, status: 'PENDING' },
  });
  if (duplicate > 0) throw conflict('Na tento predmet už máš čakajúcu žiadosť.');

  if (price.protectionFeeCents > 0 && !input.acceptProtectionDisclaimer) {
    throw badRequest('Potvrď, že rozumieš, že Ochrana prenájmu nie je poistenie.');
  }

  return prisma.$transaction(async (tx) => {
    const created = await tx.rentalRequest.create({
      data: {
        itemId: item.id,
        renterId: renter.id,
        ownerId: item.ownerId,
        ...periodAndPriceData(period, price, true),
        message: input.message ?? null,
        handoverMethod: input.handoverMethod,
        protectionMode: price.protectionMode,
        rulesAcceptedAt: new Date(),
        protectionDisclaimerAcceptedAt: input.acceptProtectionDisclaimer ? new Date() : null,
      },
    });
    await saveProtectionQuote(tx, {
      itemId: item.id,
      rentalRequestId: created.id,
      userId: renter.id,
      replacementValueCents: item.replacementValueCents,
      price,
    });
    await notify(
      item.ownerId,
      {
        type: 'RENTAL_REQUESTED',
        title: `Nová žiadosť o požičanie: ${item.title}`,
        body: `${renter.name}: ${describePeriod(period)}`,
        link: `/requests/${created.id}`,
      },
      tx,
    );
    return created;
  });
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
  | { action: 'PROPOSE_DATES'; startDate: string; endDate?: string; startTime?: string; endTime?: string; note?: string }
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
        await checkItemAvailability(item, periodOfRental(rental), { excludeRentalId: rental.id, tx });
        const updated = await setStatus(tx, rental, {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          ownerNote: input.note ?? rental.ownerNote,
          proposedStartDate: null,
          proposedEndDate: null,
          proposedStartTime: null,
          proposedEndTime: null,
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
        // The proposal keeps the rental mode of the original request.
        const period = resolvePeriod({
          rentalMode: rental.rentalMode,
          startDate: input.startDate,
          endDate: input.endDate,
          startTime: input.startTime,
          endTime: input.endTime,
        });
        await checkItemAvailability(item, period, { excludeRentalId: rental.id, tx });
        const updated = await setStatus(tx, rental, {
          proposedStartDate: new Date(`${period.startDate}T00:00:00Z`),
          proposedEndDate: new Date(`${period.endDate}T00:00:00Z`),
          proposedStartTime: period.startTime,
          proposedEndTime: period.endTime,
          ownerNote: input.note ?? null,
        });
        await notify(
          counterpart,
          { type: 'RENTAL_DATES_PROPOSED', title: `Majiteľ navrhol iný termín: ${item.title}`, body: describePeriod(period), link },
          tx,
        );
        return updated;
      }
      case 'ACCEPT_PROPOSAL': {
        await lockItem(tx, item.id);
        const period = resolvePeriod({
          rentalMode: rental.rentalMode,
          startDate: rental.proposedStartDate!.toISOString().slice(0, 10),
          endDate: rental.proposedEndDate!.toISOString().slice(0, 10),
          startTime: rental.proposedStartTime,
          endTime: rental.proposedEndTime,
        });
        await checkItemAvailability(item, period, { excludeRentalId: rental.id, tx });
        // Re-price server-side for the new period.
        const settings = await getSettings();
        const price = await calculateRentalPrice(item, period.duration, settings, await loadRiskSignals(rental.renterId, rental.ownerId));
        const updated = await setStatus(tx, rental, {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          // Keep protection only if the renter agreed to the disclaimer earlier.
          ...periodAndPriceData(period, price, Boolean(rental.protectionDisclaimerAcceptedAt)),
          proposedStartDate: null,
          proposedEndDate: null,
          proposedStartTime: null,
          proposedEndTime: null,
        });
        if (rental.protectionDisclaimerAcceptedAt) {
          await saveProtectionQuote(tx, {
            itemId: item.id,
            rentalRequestId: rental.id,
            userId: rental.renterId,
            replacementValueCents: item.replacementValueCents,
            price,
          });
        }
        await onAccepted(updated, tx);
        await notify(counterpart, { type: 'RENTAL_ACCEPTED', title: `Nájomca prijal nový termín: ${item.title}`, link }, tx);
        return updated;
      }
      case 'DECLINE_PROPOSAL': {
        const updated = await setStatus(tx, rental, { proposedStartDate: null, proposedEndDate: null, proposedStartTime: null, proposedEndTime: null });
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
