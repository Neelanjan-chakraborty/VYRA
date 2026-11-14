export type Status = 'built' | 'engine' | 'building' | 'planned';

const LABELS: Record<Status, string> = {
  built: 'In the app today',
  engine: 'Engine built · screen in development',
  building: 'In development',
  planned: 'Planned',
};

/**
 * Says plainly whether something exists yet. The marker shape differs per
 * status, so the meaning never rests on colour alone.
 */
export function StatusTag({
  status,
  className,
}: {
  readonly status: Status;
  readonly className?: string;
}) {
  return (
    <span className={`t-eyebrow inline-flex items-center gap-2 text-muted ${className ?? ''}`}>
      <span
        aria-hidden="true"
        className={
          status === 'built'
            ? 'size-2 rounded-full bg-accent'
            : status === 'planned'
              ? 'size-2 rounded-full border border-current'
              : 'size-2 rotate-45 border border-accent'
        }
      />
      {LABELS[status]}
    </span>
  );
}
