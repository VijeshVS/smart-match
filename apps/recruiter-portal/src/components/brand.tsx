import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-brand to-brand-cyan text-white shadow-lg shadow-primary/30',
        className,
      )}
    >
      <Sparkles className="size-5" aria-hidden="true" />
    </span>
  );
}

export function BrandWordmark({
  className,
  to = '/',
  subtitle,
}: {
  className?: string;
  to?: string;
  subtitle?: string;
}) {
  return (
    <Link to={to} className={cn('group inline-flex items-center gap-3', className)}>
      <BrandMark />
      <span className="flex flex-col leading-none">
        <span className="font-heading text-lg font-bold tracking-tight">
          talent<span className="text-primary">.</span>ai
        </span>
        {subtitle ? (
          <span className="mt-1 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            {subtitle}
          </span>
        ) : null}
      </span>
    </Link>
  );
}
