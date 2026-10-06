/** Convert euros (number) to integer cents, rounding half away from zero. */
export const toCents = (euros: number): number => Math.round(euros * 100 + Number.EPSILON * Math.sign(euros));

export const fromCents = (cents: number): number => cents / 100;

/** Round a cent amount that may contain fractions (e.g. after multiplying). */
export const roundCents = (cents: number): number => Math.round(cents + Number.EPSILON);
