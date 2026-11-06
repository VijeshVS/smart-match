import { useCallback, useMemo, useState } from 'react';

const STORAGE_PREFIX = 'talent.ai.unlocked.';

function read(recruiterId: string): string[] {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${recruiterId}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Talent access grants are server-authoritative; the client keeps a local
 * cache per recruiter so unlocked profiles stay readable across pages without
 * re-charging (the rewards service is idempotent as well).
 */
export function useUnlockedTalent(recruiterId: string | null) {
  const [version, setVersion] = useState(0);

  const unlocked = useMemo(() => {
    void version;
    return new Set(recruiterId ? read(recruiterId) : []);
  }, [recruiterId, version]);

  const markUnlocked = useCallback(
    (talentId: string) => {
      if (!recruiterId) return;
      const next = new Set(read(recruiterId));
      next.add(talentId);
      try {
        window.localStorage.setItem(
          `${STORAGE_PREFIX}${recruiterId}`,
          JSON.stringify([...next]),
        );
      } catch {
        // Local cache is best-effort; the server grant still applies.
      }
      setVersion((current) => current + 1);
    },
    [recruiterId],
  );

  return { unlocked, markUnlocked };
}
