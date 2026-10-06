export type Category = 'GARDEN' | 'SPORT' | 'WORKSHOP' | 'LEISURE' | 'OTHER';
export type Condition = 'NEW' | 'VERY_GOOD' | 'GOOD' | 'USED' | 'WORN';
export type RentalStatus =
  | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'ACTIVE' | 'RETURN_PENDING' | 'RETURNED' | 'DISPUTED' | 'COMPLETED';
export type ProtectionMode = 'NONE' | 'PROTECTION_FEE' | 'INSURANCE';
export type DepositStatus =
  | 'NOT_REQUIRED' | 'PENDING' | 'HELD' | 'RELEASE_REQUESTED' | 'RELEASED' | 'PARTIALLY_WITHHELD' | 'WITHHELD' | 'DISPUTED';
export type ReportType =
  | 'ITEM_DAMAGED' | 'ITEM_NOT_RETURNED' | 'ITEM_DIFFERENT_THAN_DESCRIPTION' | 'USER_BEHAVIOR' | 'PAYMENT_PROBLEM' | 'OTHER';
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
  id: string; title: string; category: Category; description: string; pricePerDayCents: number; city: string;
  condition: Condition; isActive: boolean; deactivatedByAdmin: boolean; createdAt: string;
  images: { id: string; url: string }[];
  owner: { id: string; name: string; city: string; avatarUrl: string | null; rating: RatingShort };
  rating: RatingShort; protectionAvailable: boolean; isFavorite: boolean;
}

export interface PriceBreakdown {
  rentalDays: number; pricePerDayCents: number; rentalPriceCents: number; protectionFeeCents: number;
  depositCents: number; platformFeeCents: number; totalCents: number; currency: 'EUR';
  protectionMode: ProtectionMode; protectionAvailable: boolean;
  protection: null | { provider: string; isDemo: boolean; isInsurance: boolean; available: boolean; feeCents: number; protectedValueCents: number; disclaimer: string; breakdown: Record<string, unknown> };
}

export interface ItemDetail extends Omit<ItemCard, 'owner' | 'rating'> {
  availableFrom: string; availableTo: string; replacementValueCents: number; serialNote?: string | null;
  protectionEligible: boolean;
  owner: { id: string; name: string; city: string; bio: string | null; avatarUrl: string | null; createdAt: string; rating: RatingSummary };
  rating: RatingSummary; isOwner: boolean; blockedRanges: { start: string; end: string }[]; estimate3Days: PriceBreakdown;
}

export interface Party { id: string; name: string; city: string; avatarUrl: string | null; phone: string | null; email: string | null }

export interface HandoverRecord {
  id: string; type: 'HANDOVER' | 'RETURN'; partyRole: 'OWNER' | 'RENTER'; note: string | null; itemOk: boolean | null;
  confirmedAt: string; user: { id: string; name: string }; photos: { id: string; url: string }[];
}

export interface RentalDetail {
  id: string; status: RentalStatus; startDate: string; endDate: string; proposedStartDate: string | null; proposedEndDate: string | null;
  rentalDays: number; message: string | null; ownerNote: string | null; handoverMethod: string;
  price: { pricePerDayCents: number; rentalPriceCents: number; protectionFeeCents: number; depositCents: number; platformFeeCents: number; totalCents: number; currency: string };
  protectionMode: ProtectionMode; createdAt: string; acceptedAt: string | null; activeAt: string | null; returnedAt: string | null; completedAt: string | null; cancelledAt: string | null;
  item: { id: string; title: string; category: Category; images: { id: string; url: string }[]; replacementValueCents: number };
  renter: Party; owner: Party; contactVisible: boolean;
  handoverRecords: HandoverRecord[];
  protection: null | { id: string; status: string; isDemo: boolean; feeCents: number; protectedValueCents: number; label: string | null; notice: string };
  deposit: null | { id: string; status: DepositStatus; amountCents: number; withheldCents: number; isSimulated: boolean; label: string | null };
  reports: { id: string; type: ReportType; status: ReportStatus; createdAt: string; reporterId: string }[];
  reviews: { id: string; type: 'RENTER_TO_OWNER' | 'OWNER_TO_RENTER'; authorId: string; overall: number; comment: string | null }[];
  itemReview: { id: string; overall: number } | null;
  viewerRole: 'OWNER' | 'RENTER' | null; availableActions: string[];
}

export interface RentalListEntry {
  id: string; status: RentalStatus; startDate: string; endDate: string; totalCents: number; rentalDays: number; createdAt: string;
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
  requestedAmountCents: number; approvedAmountCents: number | null; createdAt: string; updatedAt: string;
  item: { id: string; title: string; replacementValueCents: number; images: { url: string }[] };
  reporter: { id: string; name: string }; reportedUser: { id: string; name: string } | null;
  evidence: { id: string; kind: 'EVIDENCE' | 'RESPONSE' | 'ADMIN_NOTE_PUBLIC'; text: string | null; fileUrl: string | null; createdAt: string; author: { id: string; name: string } }[];
  decisions: { id: string; decision: ReportStatus; approvedAmountCents: number | null; publicNote: string | null; internalNote?: string | null; admin?: { name: string }; createdAt: string }[];
  viewerRole: 'REPORTER' | 'REPORTED' | 'ADMIN' | 'PARTICIPANT'; isOpen: boolean; disclaimer: string;
}

export interface PublicSettings {
  settings: {
    protectionMode: ProtectionMode; protectionActive: boolean; minProtectionFeeCents: number; protectionPercentage: number;
    maxProtectedValueCents: number; maxDepositCents: number; depositPercentage: number; allowedCategories: Category[];
    platformFeeEnabled: boolean; platformFeePercentage: number; protectionProvider: string; insuranceAvailable: boolean; paymentsSimulated: boolean;
  };
  texts: { protectionNotice: string; protectionNoticeSk: string; demoLabel: string; demoNotice: string; simulatedPaymentLabel: string; damageDisclaimer: string };
}

export interface Notification { id: string; type: string; title: string; body: string | null; link: string | null; readAt: string | null; createdAt: string }
