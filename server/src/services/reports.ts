import type { Prisma, ReportStatus, ReportType, User } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import { notify, notifyAdmins } from './notifications.js';
import { tryTransitionDeposit } from './deposit/index.js';
import { audit } from './audit.js';
import { loadRentalForParty, partyRole } from './rentals.js';
import { isWithinReportWindow, REPORT_WINDOW_HOURS } from './reportWindow.js';

export const DAMAGE_DISCLAIMER =
  'ShareOn neposkytuje automatické rozhodnutie o škode ani automatickú náhradu. Prípad posudzuje administrátor podľa dostupných dôkazov a pravidiel platformy.';

export { REPORT_WINDOW_HOURS };

const REPORTABLE_STATUSES = ['ACCEPTED', 'ACTIVE', 'RETURN_PENDING', 'RETURNED', 'DISPUTED', 'COMPLETED'];
const OPEN_STATUSES: ReportStatus[] = ['OPEN', 'UNDER_REVIEW', 'NEEDS_MORE_INFORMATION'];
const FINAL_STATUSES: ReportStatus[] = ['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'RESOLVED'];

export interface CreateReportInput {
  rentalRequestId: string;
  type: ReportType;
  description: string;
  requestedAmountCents: number;
  photos: string[];
  contactNote?: string | null;
}

/** Opens a damage report / dispute for a rental. Never approves anything automatically. */
export const createReport = async (user: User, input: CreateReportInput) => {
  const { rental } = await loadRentalForParty(input.rentalRequestId, user);
  const role = partyRole(rental, user.id);
  if (!role) throw forbidden('Nahlásiť problém môže len účastník prenájmu.');
  if (!REPORTABLE_STATUSES.includes(rental.status)) {
    throw conflict('Problém je možné nahlásiť až po prijatí žiadosti.');
  }
  if (!isWithinReportWindow(rental)) {
    throw conflict(`Problém je možné nahlásiť najneskôr ${REPORT_WINDOW_HOURS} hodín po vrátení veci.`);
  }
  const item = await prisma.item.findUniqueOrThrow({ where: { id: rental.itemId } });
  if (input.requestedAmountCents > item.replacementValueCents) {
    throw badRequest('Požadovaná suma nemôže byť vyššia ako odhadovaná hodnota predmetu.');
  }
  const counterpart = role === 'OWNER' ? rental.renterId : rental.ownerId;

  return prisma.$transaction(async (tx) => {
    const report = await tx.damageReport.create({
      data: {
        rentalRequestId: rental.id,
        itemId: rental.itemId,
        reporterId: user.id,
        reportedUserId: counterpart,
        type: input.type,
        description: input.description,
        requestedAmountCents: input.requestedAmountCents,
        contactNote: input.contactNote ?? null,
        evidence: {
          create: input.photos.map((url) => ({ authorId: user.id, kind: 'EVIDENCE' as const, fileUrl: url })),
        },
      },
    });
    if (rental.status !== 'COMPLETED' && rental.status !== 'DISPUTED') {
      await tx.rentalRequest.update({ where: { id: rental.id }, data: { status: 'DISPUTED' } });
    }
    await tryTransitionDeposit(rental.id, 'DISPUTED', tx);
    if (input.type === 'ITEM_DAMAGED' || input.type === 'ITEM_NOT_RETURNED') {
      await tx.protectionRecord.updateMany({
        where: { rentalRequestId: rental.id, status: { in: ['ACTIVE', 'EXPIRED'] } },
        data: { status: 'CLAIM_UNDER_REVIEW' },
      });
    }
    const link = `/reports/${report.id}`;
    await notify(counterpart, { type: 'REPORT_CREATED', title: `Bol nahlásený problém k prenájmu: ${item.title}`, body: 'Môžeš pridať svoju odpoveď a dôkazy.', link }, tx);
    await notifyAdmins({ type: 'REPORT_CREATED', title: `Nový spor: ${item.title}`, link }, tx);
    return report;
  });
};

export const loadReportForUser = async (reportId: string, user: User) => {
  const report = await prisma.damageReport.findUnique({
    where: { id: reportId },
    include: {
      rentalRequest: {
        include: {
          renter: { select: { id: true, name: true, email: true, phone: true } },
          owner: { select: { id: true, name: true, email: true, phone: true } },
        },
      },
      item: { select: { id: true, title: true, replacementValueCents: true, images: { take: 1, orderBy: { position: 'asc' } } } },
      reporter: { select: { id: true, name: true, avatarUrl: true } },
      reportedUser: { select: { id: true, name: true, avatarUrl: true } },
      evidence: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } },
      decisions: { include: { admin: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!report) throw notFound('Hlásenie sa nenašlo.');
  const isAdmin = user.role === 'ADMIN';
  const participants = new Set([report.reporterId, report.reportedUserId, report.rentalRequest?.ownerId, report.rentalRequest?.renterId]);
  if (!isAdmin && !participants.has(user.id)) throw forbidden('Toto hlásenie ti nepatrí.');
  return { report, isAdmin };
};

export const serializeReport = (r: Awaited<ReturnType<typeof loadReportForUser>>['report'], isAdmin: boolean, viewerId: string) => ({
  id: r.id,
  rentalRequestId: r.rentalRequestId,
  item: r.item,
  reporter: r.reporter,
  reportedUser: r.reportedUser,
  type: r.type,
  description: r.description,
  contactNote: r.contactNote,
  status: r.status,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  evidence: r.evidence,
  // Reservation details and contacts are for the admin only.
  rental:
    isAdmin && r.rentalRequest
      ? {
          id: r.rentalRequest.id,
          status: r.rentalRequest.status,
          rentalMode: r.rentalRequest.rentalMode,
          startAt: r.rentalRequest.startAt,
          endAt: r.rentalRequest.endAt,
          returnedAt: r.rentalRequest.returnedAt,
          rentalPriceCents: r.rentalRequest.rentalPriceCents,
          protectionFeeCents: r.rentalRequest.protectionFeeCents,
          renter: r.rentalRequest.renter,
          owner: r.rentalRequest.owner,
        }
      : undefined,
  decisions: r.decisions.map((d) => ({
    id: d.id,
    decision: d.decision,
    publicNote: d.publicNote,
    // Internal notes are admin-only.
    internalNote: isAdmin ? d.internalNote : undefined,
    admin: isAdmin ? d.admin : undefined,
    createdAt: d.createdAt,
  })),
  viewerRole: r.reporterId === viewerId ? 'REPORTER' : r.reportedUserId === viewerId ? 'REPORTED' : isAdmin ? 'ADMIN' : 'PARTICIPANT',
  isOpen: OPEN_STATUSES.includes(r.status),
  disclaimer: DAMAGE_DISCLAIMER,
});

export const addEvidence = async (
  user: User,
  reportId: string,
  input: { text?: string | null; fileUrl?: string | null },
  kind: 'EVIDENCE' | 'RESPONSE',
) => {
  const { report, isAdmin } = await loadReportForUser(reportId, user);
  if (FINAL_STATUSES.includes(report.status)) throw conflict('Hlásenie je uzavreté.');
  if (kind === 'RESPONSE' && report.reportedUserId !== user.id) {
    throw forbidden('Odpovedať môže len druhá strana sporu.');
  }
  if (kind === 'EVIDENCE' && isAdmin && report.reporterId !== user.id && report.reportedUserId !== user.id) {
    throw forbidden('Administrátor pridáva poznámky cez rozhodnutie.');
  }
  if (!input.text && !input.fileUrl) throw badRequest('Pridaj text alebo fotografiu.');
  return prisma.$transaction(async (tx) => {
    const ev = await tx.reportEvidence.create({
      data: { reportId: report.id, authorId: user.id, kind, text: input.text ?? null, fileUrl: input.fileUrl ?? null },
    });
    // New information arrived → back to review queue.
    if (report.status === 'NEEDS_MORE_INFORMATION') {
      await tx.damageReport.update({ where: { id: report.id }, data: { status: 'UNDER_REVIEW' } });
    }
    const other = user.id === report.reporterId ? report.reportedUserId : report.reporterId;
    if (other) {
      await notify(other, { type: 'REPORT_UPDATED', title: kind === 'RESPONSE' ? 'Druhá strana odpovedala na hlásenie' : 'K hláseniu boli pridané dôkazy', link: `/reports/${report.id}` }, tx);
    }
    return ev;
  });
};

/** Re-opens rental flow when a dispute is closed. */
const closeRentalDisputeIfDone = async (tx: Prisma.TransactionClient, rentalRequestId: string | null) => {
  if (!rentalRequestId) return;
  const stillOpen = await tx.damageReport.count({
    where: { rentalRequestId, status: { in: OPEN_STATUSES } },
  });
  if (stillOpen > 0) return;
  const rental = await tx.rentalRequest.findUnique({ where: { id: rentalRequestId } });
  if (rental?.status === 'DISPUTED') {
    await tx.rentalRequest.update({
      where: { id: rentalRequestId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }
};

export type AdminReportStatus = 'UNDER_REVIEW' | 'NEEDS_MORE_INFORMATION' | 'RESOLVED' | 'REJECTED';

const STATUS_TITLES: Record<AdminReportStatus, string> = {
  UNDER_REVIEW: 'Hlásenie sa posudzuje',
  NEEDS_MORE_INFORMATION: 'Administrátor potrebuje viac informácií k hláseniu',
  RESOLVED: 'Hlásenie bolo vyriešené',
  REJECTED: 'Hlásenie bolo zamietnuté',
};

/**
 * Admin status change with an optional public note (shown to both parties) and an internal note (admins only).
 * Every change is stored as an AdminDecision and in the audit log. Nothing is approved or paid out automatically.
 */
export const adminSetReportStatus = async (
  admin: User,
  reportId: string,
  status: AdminReportStatus,
  notes: { publicNote?: string | null; internalNote?: string | null } = {},
) => {
  const report = await prisma.damageReport.findUnique({ where: { id: reportId } });
  if (!report) throw notFound('Hlásenie sa nenašlo.');
  if (report.status === status) throw conflict('Hlásenie už má tento stav.');
  if (FINAL_STATUSES.includes(report.status) && !(status === 'RESOLVED' && report.status !== 'RESOLVED' && report.status !== 'REJECTED')) {
    throw conflict('Hlásenie je už uzavreté.');
  }
  return prisma.$transaction(async (tx) => {
    const updated = await tx.damageReport.update({ where: { id: report.id }, data: { status } });
    await tx.adminDecision.create({
      data: {
        reportId: report.id,
        adminId: admin.id,
        decision: status,
        publicNote: notes.publicNote || null,
        internalNote: notes.internalNote || null,
      },
    });
    if (status === 'RESOLVED' || status === 'REJECTED') {
      if (report.rentalRequestId) {
        await tx.protectionRecord.updateMany({
          where: { rentalRequestId: report.rentalRequestId, status: 'CLAIM_UNDER_REVIEW' },
          data: { status: 'EXPIRED' },
        });
      }
      await closeRentalDisputeIfDone(tx, report.rentalRequestId);
    }
    await audit(
      {
        adminId: admin.id,
        action: 'REPORT_STATUS_CHANGED',
        entityType: 'DamageReport',
        entityId: report.id,
        oldValue: { status: report.status },
        newValue: { status, publicNote: notes.publicNote ?? null, internalNote: notes.internalNote ?? null },
      },
      tx,
    );
    for (const uid of [report.reporterId, report.reportedUserId].filter(Boolean) as string[]) {
      await notify(uid, { type: 'REPORT_STATUS', title: STATUS_TITLES[status], body: notes.publicNote ?? undefined, link: `/reports/${report.id}` }, tx);
    }
    return updated;
  });
};

export { OPEN_STATUSES, FINAL_STATUSES };
