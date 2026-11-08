-- Deferring keeps a candidate in the pipeline without approving or rejecting them.
ALTER TYPE "SwipeDecision" ADD VALUE IF NOT EXISTS 'DEFER';
