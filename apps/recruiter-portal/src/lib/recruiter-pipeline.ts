import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { engagementApi, rewardsApi, toApiClientError } from '@talent-ai/api-client';

export type PipelineTab = 'ALL' | 'INTERESTED' | 'UNLOCKED';

interface PipelineLoadResult {
  interestedIds: Set<string>;
  unlockedIds: Set<string>;
  errors: string[];
}

/**
 * Server-authoritative recruiter pipeline: candidates explicitly marked as
 * interested in TalentLens plus Elite profiles unlocked with TalentCredits.
 *
 * Both reads are self-scoped by the API services, so the hook never trusts a
 * client-supplied recruiter id when deciding who may see which candidates.
 */
export function useRecruiterPipeline(recruiterId: string | null) {
  const [interestedIds, setInterestedIds] = useState<Set<string>>(() => new Set());
  const [unlockedIds, setUnlockedIds] = useState<Set<string>>(() => new Set());
  const [pendingInterestIds, setPendingInterestIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(Boolean(recruiterId));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<PipelineLoadResult> => {
    if (!recruiterId) {
      return { interestedIds: new Set(), unlockedIds: new Set(), errors: [] };
    }

    setLoading(true);
    setError(null);

    const [interestsResult, grantsResult] = await Promise.allSettled([
      engagementApi.listInterests(),
      rewardsApi.listAccessGrants(),
    ]);

    const errors: string[] = [];
    let nextInterestedIds = new Set<string>();
    let nextUnlockedIds = new Set<string>();

    if (interestsResult.status === 'fulfilled') {
      nextInterestedIds = new Set(interestsResult.value.map((interest) => interest.talentId));
      setInterestedIds(nextInterestedIds);
    } else {
      errors.push(toApiClientError(interestsResult.reason).message);
    }

    if (grantsResult.status === 'fulfilled') {
      nextUnlockedIds = new Set(grantsResult.value.map((grant) => grant.talentId));
      setUnlockedIds(nextUnlockedIds);
    } else {
      errors.push(toApiClientError(grantsResult.reason).message);
    }

    setError(errors.length > 0 ? errors.join(' ') : null);
    setLoading(false);

    return { interestedIds: nextInterestedIds, unlockedIds: nextUnlockedIds, errors };
  }, [recruiterId]);

  useEffect(() => {
    void load();
  }, [load]);

  const isInterested = useCallback(
    (talentId: string) => interestedIds.has(talentId),
    [interestedIds],
  );

  const isInterestPending = useCallback(
    (talentId: string) => pendingInterestIds.has(talentId),
    [pendingInterestIds],
  );

  const toggleInterest = useCallback(
    async (talentId: string) => {
      if (!recruiterId || pendingInterestIds.has(talentId)) return;

      const wasInterested = interestedIds.has(talentId);

      setPendingInterestIds((current) => {
        const next = new Set(current);
        next.add(talentId);
        return next;
      });

      // Optimistic UI: the card and pipeline tabs react immediately.
      setInterestedIds((current) => {
        const next = new Set(current);
        if (wasInterested) next.delete(talentId);
        else next.add(talentId);
        return next;
      });

      try {
        if (wasInterested) {
          await engagementApi.removeInterest(talentId);
          toast.success('Removed from your candidate pipeline');
        } else {
          await engagementApi.markInterest(talentId);
          toast.success('Added to your candidate pipeline');
        }
      } catch (cause) {
        // Roll back the optimistic change when persistence fails.
        setInterestedIds((current) => {
          const next = new Set(current);
          if (wasInterested) next.add(talentId);
          else next.delete(talentId);
          return next;
        });
        toast.error(toApiClientError(cause).message);
      } finally {
        setPendingInterestIds((current) => {
          const next = new Set(current);
          next.delete(talentId);
          return next;
        });
      }
    },
    [interestedIds, pendingInterestIds, recruiterId],
  );

  const markUnlocked = useCallback((talentId: string) => {
    setUnlockedIds((current) => {
      const next = new Set(current);
      next.add(talentId);
      return next;
    });
  }, []);

  /** De-duplicated union used as the talent-service inclusion boundary. */
  const allScopedIds = useMemo(
    () => [...new Set([...interestedIds, ...unlockedIds])].sort(),
    [interestedIds, unlockedIds],
  );

  return {
    interestedIds,
    unlockedIds,
    allScopedIds,
    loading,
    error,
    reload: load,
    isInterested,
    isInterestPending,
    toggleInterest,
    markUnlocked,
  };
}
