import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RewardsPrincipal } from '../src/middleware/auth.js';

const tx = vi.hoisted(() => ({
  wallet: {
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  ledgerTransaction: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  outboxEvent: {
    create: vi.fn(),
  },
}));

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

vi.mock('../src/lib/prisma.js', () => ({ prisma: prismaMock }));
vi.mock('../src/lib/outbox.js', () => ({ enqueueOutbox: vi.fn() }));

const { chargeTalentLensQuery, refundTalentLensQuery } =
  await import('../src/services/rewards.service.js');

const recruiter: RewardsPrincipal = {
  userId: '11111111-1111-4111-8111-111111111111',
  email: 'riley@acme.com',
  role: 'RECRUITER',
  permissions: [],
};

const queryId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const now = new Date('2026-11-09T10:00:00.000Z');

const walletRow = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  recruiterId: recruiter.userId,
  balance: 40,
  version: 3,
  createdAt: now,
  updatedAt: now,
};

const welcomeBonusRow = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  walletId: walletRow.id,
  amount: 20,
  type: 'CREDIT_WELCOME_BONUS',
  referenceId: walletRow.id,
  description: 'Welcome bonus',
  balanceAfter: 20,
  createdAt: now,
};

const debitRow = {
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  walletId: walletRow.id,
  amount: -15,
  type: 'DEBIT_TALENT_LENS_QUERY',
  referenceId: queryId,
  description: 'TalentLens search query',
  balanceAfter: 25,
  createdAt: now,
};

const refundRow = {
  id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
  walletId: walletRow.id,
  amount: 15,
  type: 'CREDIT_TALENT_LENS_REFUND',
  referenceId: queryId,
  description: 'TalentLens query refund',
  balanceAfter: 40,
  createdAt: now,
};

function mockLedgerLookup({ debit = false, refund = false } = {}): void {
  tx.ledgerTransaction.findUnique.mockImplementation(
    async ({ where }: { where: { type_referenceId: { type: string; referenceId: string } } }) => {
      const { type, referenceId } = where.type_referenceId;

      if (type === 'CREDIT_WELCOME_BONUS') return welcomeBonusRow;
      if (type === 'DEBIT_TALENT_LENS_QUERY' && referenceId === queryId) {
        return debit ? debitRow : null;
      }
      if (type === 'CREDIT_TALENT_LENS_REFUND' && referenceId === queryId) {
        return refund ? refundRow : null;
      }
      return null;
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(
    async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  );

  tx.wallet.findUnique.mockResolvedValue(walletRow);
  tx.wallet.findUniqueOrThrow.mockResolvedValue({ ...walletRow, balance: 25, version: 4 });
  tx.wallet.updateMany.mockResolvedValue({ count: 1 });
  tx.wallet.update.mockResolvedValue({ ...walletRow, balance: 40, version: 4 });
  tx.ledgerTransaction.create.mockImplementation(
    async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      createdAt: now,
      ...data,
    }),
  );
  mockLedgerLookup();
});

describe('TalentLens query credits', () => {
  it('debits 15 TC and records a DEBIT_TALENT_LENS_QUERY ledger row', async () => {
    const result = await chargeTalentLensQuery({ queryId }, recruiter);

    expect(tx.wallet.updateMany).toHaveBeenCalledWith({
      where: { id: walletRow.id, version: walletRow.version },
      data: { balance: { decrement: 15 }, version: { increment: 1 } },
    });
    expect(tx.ledgerTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: -15,
        type: 'DEBIT_TALENT_LENS_QUERY',
        referenceId: queryId,
        balanceAfter: 25,
      }),
    });
    expect(result).toMatchObject({
      charged: true,
      chargedCredits: 15,
      wallet: { balance: 25 },
    });
  });

  it('rejects a search when the balance is below 15 TC without mutating the wallet', async () => {
    tx.wallet.findUnique.mockResolvedValue({ ...walletRow, balance: 10 });

    await expect(chargeTalentLensQuery({ queryId }, recruiter)).rejects.toMatchObject({
      status: 402,
      code: 'INSUFFICIENT_CREDITS',
      details: { requiredCredits: 15, balance: 10 },
    });

    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
    expect(tx.ledgerTransaction.create).not.toHaveBeenCalled();
  });

  it('treats a repeated queryId as an idempotent replay', async () => {
    mockLedgerLookup({ debit: true });

    const result = await chargeTalentLensQuery({ queryId }, recruiter);

    expect(result).toMatchObject({ charged: false, chargedCredits: 0 });
    expect(tx.wallet.updateMany).not.toHaveBeenCalled();
    expect(tx.ledgerTransaction.create).not.toHaveBeenCalled();
  });

  it('refunds a debit exactly once and leaves the balance unchanged', async () => {
    mockLedgerLookup({ debit: true });

    const result = await refundTalentLensQuery({ queryId }, recruiter);

    expect(tx.wallet.update).toHaveBeenCalledWith({
      where: { id: walletRow.id },
      data: { balance: { increment: 15 }, version: { increment: 1 } },
    });
    expect(tx.ledgerTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        amount: 15,
        type: 'CREDIT_TALENT_LENS_REFUND',
        referenceId: queryId,
        balanceAfter: 40,
      }),
    });
    expect(result).toMatchObject({ refunded: true, refundedCredits: 15 });
  });

  it('does not refund when no debit exists', async () => {
    mockLedgerLookup({ debit: false });

    const result = await refundTalentLensQuery({ queryId }, recruiter);

    expect(result).toMatchObject({ refunded: false, refundedCredits: 0 });
    expect(tx.wallet.update).not.toHaveBeenCalled();
    expect(tx.ledgerTransaction.create).not.toHaveBeenCalled();
  });

  it('does not refund the same query twice', async () => {
    mockLedgerLookup({ debit: true, refund: true });

    const result = await refundTalentLensQuery({ queryId }, recruiter);

    expect(result).toMatchObject({ refunded: false, refundedCredits: 0 });
    expect(tx.wallet.update).not.toHaveBeenCalled();
    expect(tx.ledgerTransaction.create).not.toHaveBeenCalled();
  });
});
