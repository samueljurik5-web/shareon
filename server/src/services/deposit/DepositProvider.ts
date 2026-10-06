/**
 * Payment/deposit provider abstraction. The MVP only ships MockDepositProvider:
 * no money is moved, every state is labelled “SIMULATED PAYMENT”.
 * Extension point: implement e.g. StripeDepositProvider (authorise & capture / refund).
 */
export interface DepositProvider {
  readonly name: string;
  readonly isSimulated: boolean;
  /** Places a hold for the amount. Must be idempotent on idempotencyKey. */
  hold(input: { amountCents: number; currency: string; idempotencyKey: string }): Promise<{ reference: string }>;
  release(reference: string): Promise<void>;
  withhold(reference: string, amountCents: number): Promise<void>;
}

export const SIMULATED_PAYMENT_LABEL = 'SIMULATED PAYMENT';

export class MockDepositProvider implements DepositProvider {
  readonly name = 'mock';
  readonly isSimulated = true;

  async hold(input: { idempotencyKey: string }) {
    return { reference: `sim_${input.idempotencyKey}` };
  }

  async release(_reference: string) {}

  async withhold(_reference: string, _amountCents: number) {}
}

export const depositProvider: DepositProvider = new MockDepositProvider();
