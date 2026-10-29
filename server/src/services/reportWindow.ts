/** A problem can be reported at the latest this many hours after the item was returned. */
export const REPORT_WINDOW_HOURS = 48;

/** True until 48 h after the return (or completion); always true before the item is returned. */
export const isWithinReportWindow = (rental: { returnedAt: Date | null; completedAt: Date | null }, now = Date.now()) => {
  const returnedAt = rental.returnedAt ?? rental.completedAt;
  return !returnedAt || now - returnedAt.getTime() <= REPORT_WINDOW_HOURS * 3_600_000;
};
