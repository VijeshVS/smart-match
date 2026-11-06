import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import {
  talentApi,
  toApiClientError,
  TALENT_LEVELS,
  TALENT_LEVEL_LABELS,
  type PaginationMeta,
  type TalentLevel,
  type TalentProfile,
} from '@talent-ai/api-client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { CandidateCard } from '@/components/candidate-card';
import { CandidateDialog } from '@/components/candidate-dialog';
import { UnlockDialog } from '@/components/unlock-dialog';
import { useAuth } from '@/lib/auth';
import { useUnlockedTalent } from '@/lib/unlocked';
import { formatNumber } from '@/lib/format';

const PAGE_SIZE = 9;
const ALL = 'ALL';

interface Filters {
  search: string;
  level: TalentLevel | typeof ALL;
  field: string;
  minExperienceYears: string;
}

const EMPTY_FILTERS: Filters = {
  search: '',
  level: ALL,
  field: '',
  minExperienceYears: '',
};

export function CandidatesPage() {
  const { org } = useAuth();
  const recruiterId = org?.profile.id ?? null;
  const { unlocked, markUnlocked } = useUnlockedTalent(recruiterId);

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);

  const [profiles, setProfiles] = useState<TalentProfile[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<TalentProfile | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [unlockTarget, setUnlockTarget] = useState<TalentProfile | null>(null);
  const [unlockOpen, setUnlockOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filters.search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters.level, filters.field, filters.minExperienceYears]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const minExperience = Number(filters.minExperienceYears);

    try {
      const result = await talentApi.listProfiles({
        page,
        limit: PAGE_SIZE,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(filters.level !== ALL ? { level: filters.level } : {}),
        ...(filters.field.trim() ? { field: filters.field.trim() } : {}),
        ...(filters.minExperienceYears && !Number.isNaN(minExperience)
          ? { minExperienceYears: minExperience }
          : {}),
      });
      setProfiles(result.data);
      setMeta(result.meta);
    } catch (cause) {
      setError(toApiClientError(cause).message);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filters.level, filters.field, filters.minExperienceYears]);

  useEffect(() => {
    void load();
  }, [load]);

  const isLocked = useCallback(
    (profile: TalentProfile) =>
      profile.level === 'LEVEL_3_LEAD' && !unlocked.has(profile.id),
    [unlocked],
  );

  const lockedCount = useMemo(
    () => profiles.filter((profile) => isLocked(profile)).length,
    [profiles, isLocked],
  );

  const openDetail = (profile: TalentProfile) => {
    setSelected(profile);
    setDetailOpen(true);
  };

  const openUnlock = (profile: TalentProfile) => {
    setUnlockTarget(profile);
    setUnlockOpen(true);
    setDetailOpen(false);
  };

  const activeFilterCount =
    Number(Boolean(debouncedSearch)) +
    Number(filters.level !== ALL) +
    Number(Boolean(filters.field.trim())) +
    Number(Boolean(filters.minExperienceYears));

  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="flex flex-col gap-6">
      <Card className="glass">
        <CardHeader className="gap-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="size-4 text-brand-cyan" />
            Find verified talent
          </CardTitle>
          <CardDescription>
            Filter by tier, field and experience. Elite Principal profiles reveal contacts after a
            TalentCredits unlock.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field className="xl:col-span-2">
              <FieldLabel htmlFor="candidate-search">Search</FieldLabel>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="candidate-search"
                  value={filters.search}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, search: event.target.value }))
                  }
                  placeholder="Name, skill or keyword"
                  className="pl-9"
                />
              </div>
            </Field>

            <Field>
              <FieldLabel>Tier</FieldLabel>
              <Select
                value={filters.level}
                onValueChange={(value) =>
                  setFilters((current) => ({ ...current, level: value as Filters['level'] }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Any tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Any tier</SelectItem>
                  {TALENT_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {TALENT_LEVEL_LABELS[level]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="candidate-field">Field</FieldLabel>
              <Input
                id="candidate-field"
                value={filters.field}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, field: event.target.value }))
                }
                placeholder="e.g. Backend"
              />
            </Field>

            <Field>
              <FieldLabel>Minimum experience</FieldLabel>
              <Select
                value={filters.minExperienceYears || ALL}
                onValueChange={(value) =>
                  setFilters((current) => ({
                    ...current,
                    minExperienceYears: value === ALL ? '' : value,
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Any experience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Any experience</SelectItem>
                  <SelectItem value="2">2+ years</SelectItem>
                  <SelectItem value="5">5+ years</SelectItem>
                  <SelectItem value="8">8+ years</SelectItem>
                  <SelectItem value="12">12+ years</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              <SlidersHorizontal className="size-3.5" />
              {activeFilterCount > 0 ? `${activeFilterCount} active filter(s)` : 'No filters'}
            </Badge>
            {lockedCount > 0 ? (
              <Badge variant="secondary">{lockedCount} locked Elite profile(s)</Badge>
            ) : null}
            {activeFilterCount > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters(EMPTY_FILTERS)}
                className="ml-auto"
              >
                Clear filters
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <Users />
          <AlertTitle>Could not load candidates</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {meta ? (
            <>
              Showing <span className="font-medium text-foreground">{profiles.length}</span> of{' '}
              <span className="font-medium text-foreground">{formatNumber(meta.total)}</span>{' '}
              verified profiles
            </>
          ) : (
            'Loading talent directory…'
          )}
        </p>
        {meta && meta.totalPages > 1 ? (
          <p className="text-xs text-muted-foreground">
            Page {meta.page} of {meta.totalPages}
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-72" />
          ))}
        </div>
      ) : profiles.length === 0 ? (
        <Empty className="glass">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>No candidates match those filters</EmptyTitle>
            <EmptyDescription>
              Widen the tier or experience range, or clear the search to see the full directory.
            </EmptyDescription>
          </EmptyHeader>
          <Button variant="outline" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
            Clear filters
          </Button>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {profiles.map((profile) => (
            <CandidateCard
              key={profile.id}
              profile={profile}
              locked={isLocked(profile)}
              onView={() => openDetail(profile)}
              onUnlock={() => openUnlock(profile)}
            />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft data-icon="inline-start" />
                Previous
              </Button>
            </PaginationItem>
            <PaginationItem>
              <span className="px-2 text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
            </PaginationItem>
            <PaginationItem>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                Next
                <ChevronRight data-icon="inline-end" />
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}

      <CandidateDialog
        profile={selected}
        locked={selected ? isLocked(selected) : false}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUnlock={() => {
          if (selected) openUnlock(selected);
        }}
      />

      <UnlockDialog
        profile={unlockTarget}
        open={unlockOpen}
        onOpenChange={setUnlockOpen}
        onUnlocked={(talentId) => {
          markUnlocked(talentId);
          void load();
        }}
      />
    </div>
  );
}
