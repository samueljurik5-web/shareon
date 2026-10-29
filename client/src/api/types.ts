export type Category = 'GARDEN' | 'SPORT' | 'WORKSHOP' | 'LEISURE' | 'ELECTRONICS' | 'HOUSEHOLD' | 'OTHER';
export type Condition = 'NEW' | 'VERY_GOOD' | 'GOOD' | 'USED' | 'WORN';
export type RentalStatus =
  | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'ACTIVE' | 'RETURN_PENDING' | 'RETURNED' | 'DISPUTED' | 'COMPLETED';
export type ProtectionMode = 'NONE' | 'PROTECTION_FEE' | 'INSURANCE';
export type RentalMode = 'DAILY' | 'HOURLY';
export type ReportType =
  | 'ITEM_DAMAGED' | 'ITEM_NOT_RETURNED' | 'LATE_RETURN' | 'ITEM_DIFFERENT_THAN_DESCRIPTION' | 'USER_BEHAVIOR' | 'PAYMENT_PROBLEM' | 'OTHER';
export type ReportStatus =
  | 'OPEN' | 'UNDER_REVIEW' | 'NEEDS_MORE_INFORMATION' | 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED' | 'RESOLVED';

export interface RatingShort { average: number | null; count: number }
export interface RatingSummary extends RatingShort { distribution: Record<'1' | '2' | '3' | '4' | '5', number> }

export interface Me {
  id: string; name: string; email: string; phone: string; city: string; bio: string | null; avatarUrl: string | null;
  role: 'USER' | 'ADMIN'; isActive: boolean; createdAt: string;
  rating?: RatingSummary; stats?: UserStats; unreadNotifications?: number;
}
export interface UserStats { completedRentals: number; successfulReturns: number; cancelledRentals: number }

export interface ItemCard {
  id: string; title: string; category: Category; description: string; city: string;
  /** Košice district (approximate location) and straight-line distance from the city centre */
  district: string | null; distanceKm: number | null;
  /** server estimate: a rental could start today */
  availableToday: boolean;
  /** Sample listing ("Ukážka") – shown, but cannot be booked */
  isDemo: boolean;
  dailyPriceCents: number | null; hourlyPriceCents: number | null; dailyRentalEnabled: boolean; hourlyRentalEnabled: boolean;
  condition: Condition; isActive: boolean; deactivatedByAdmin: boolean; createdAt: string;
  images: { id: string; url: string }[];
  owner: { id: string; name: string; city: string; avatarUrl: string | null; rating: RatingShort };
  rating: RatingShort; isFavorite: boolean;
}

export interface PriceBreakdown {
  rentalMode: RentalMode; durationMinutes: number | null; durationDays: number | null; units: number; unit: 'HOUR' | 'DAY';
  /** rental + Ochrana prenájmu (+ platform fee). ShareOn has no deposit. */
  pricePerUnitCents: number; rentalPriceCents: number; protectionFeeCents: number;
  platformFeeCents: number; totalCents: number; currency: 'EUR';
  protection: { provider: string; isDemo: boolean; available: boolean; feeCents: number; disclaimer: string };
}

export interface ItemDetail extends Omit<ItemCard, 'owner' | 'rating' | 'availableToday'> {
  availableFrom: string; availableTo: string; replacementValueCents: number; serialNote?: string | null;
  minRentalHours: number; maxRentalHours: number; minRentalDays: number; maxRentalDays: number;
  availableFromTime: string; availableToTime: string; bufferHours: number;
  owner: { id: string; name: string; city: string; bio: string | null; avatarUrl: string | null; createdAt: string; rating: RatingSummary };
  rating: RatingSummary; isOwner: boolean;
  blockedRanges: { mode: RentalMode; start: string; end: string; startTime: string | null; endTime: string | null }[];
  estimateDaily: PriceBreakdown | null; estimateHourly: PriceBreakdown | null;
}

export interface Party { id: string; name: string; city: string; avatarUrl: string | null; phone: string | null; email: string | null }

export interface HandoverRecord {
  id: string; type: 'HANDOVER' | 'RETURN'; partyRole: 'OWNER' | 'RENTER'; note: string | null; itemOk: boolean | null;
  confirmedAt: string; user: { id: string; name: string }; photos: { id: string; url: string }[];
}

export interface RentalPeriodFields {
  rentalMode: RentalMode; startDate: string; endDate: string; startTime: string | null; endTime: string | null;
  durationMinutes: number | null; durationDays: number | null;
}

export interface RentalDetail extends RentalPeriodFields {
  id: string; status: RentalStatus; proposedStartDate: string | null; proposedEndDate: string | null;
  proposedStartTime: string | null; proposedEndTime: string | null; startAt: string; endAt: string; isOverdue: boolean;
  message: string | null; ownerNote: string | null; handoverMethod: string;
  price: { pricePerUnitCents: number; rentalPriceCents: number; protectionFeeCents: number; platformFeeCents: number; totalCents: number; currency: string };
  protectionMode: ProtectionMode; createdAt: string; acceptedAt: string | null; activeAt: string | null; returnedAt: string | null; completedAt: string | null; cancelledAt: string | null;
  item: { id: string; title: string; category: Category; images: { id: string; url: string }[]; replacementValueCents: number };
  renter: Party; owner: Party; contactVisible: boolean;
  handoverRecords: HandoverRecord[];
  protection: null | { id: string; status: string; feeCents: number; notice: string };
  paymentNotice: string;
  reports: { id: string; type: ReportType; status: ReportStatus; createdAt: string; reporterId: string }[];
  reviews: { id: string; type: 'RENTER_TO_OWNER' | 'OWNER_TO_RENTER'; authorId: string; overall: number; comment: string | null }[];
  itemReview: { id: string; overall: number } | null;
  viewerRole: 'OWNER' | 'RENTER' | null; availableActions: string[];
}

export interface RentalListEntry extends RentalPeriodFields {
  id: string; status: RentalStatus; totalCents: number; createdAt: string;
  item: { id: string; title: string; category: Category; images: { url: string }[] };
  renter: { id: string; name: string }; owner: { id: string; name: string };
  reviews: { id: string; type: string; authorId: string }[]; itemReview: { id: string } | null;
}

export interface Review {
  id: string; overall: number; comment: string | null; createdAt: string; type?: string;
  punctuality?: number | null; communication?: number | null; reliability?: number | null; respectfulUse?: number | null; onTimeReturn?: number | null;
  descriptionAccuracy?: number; itemCondition?: number; valueForMoney?: number; handoverExperience?: number;
  author: { id: string; name: string; avatarUrl: string | null };
}

export interface ReportDetail {
  id: string; rentalRequestId: string | null; type: ReportType; description: string; status: ReportStatus;
  contactNote: string | null; createdAt: string; updatedAt: string;
  item: { id: string; title: string; replacementValueCents: number; images: { url: string }[] };
  reporter: { id: string; name: string }; reportedUser: { id: string; name: string } | null;
  evidence: { id: string; kind: 'EVIDENCE' | 'RESPONSE' | 'ADMIN_NOTE_PUBLIC'; text: string | null; fileUrl: string | null; createdAt: string; author: { id: string; name: string } }[];
  decisions: { id: string; decision: ReportStatus; publicNote: string | null; internalNote?: string | null; admin?: { name: string }; createdAt: string }[];
  /** Admin only: reservation details and contacts of both parties */
  rental?: {
    id: string; status: RentalStatus; rentalMode: RentalMode; startAt: string; endAt: string; returnedAt: string | null;
    rentalPriceCents: number; protectionFeeCents: number;
    renter: { id: string; name: string; email: string; phone: string }; owner: { id: string; name: string; email: string; phone: string };
  };
  viewerRole: 'REPORTER' | 'REPORTED' | 'ADMIN' | 'PARTICIPANT'; isOpen: boolean; disclaimer: string;
}

export interface PublicSettings {
  settings: {
    protectionFee: { rate: number; minCents: number; maxCents: number }; reportWindowHours: number;
    platformFeeEnabled: boolean; platformFeePercentage: number; paymentsSimulated: boolean;
  };
  texts: { protectionNotice: string; protectionHint: string; paymentNotice: string; mvpNotice: string; damageDisclaimer: string };
}

export type FeedbackType = 'LIKE' | 'BUG' | 'FEATURE' | 'TESTER';
export interface FeedbackEntry {
  id: string; type: FeedbackType; contact: string | null; message: string; createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

export interface Notification { id: string; type: string; title: string; body: string | null; link: string | null; readAt: string | null; createdAt: string }
