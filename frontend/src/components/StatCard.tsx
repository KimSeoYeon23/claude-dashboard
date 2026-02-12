interface Props {
  label: string;
  value: string;
  sub?: string;
}

export default function StatCard({ label, value, sub }: Props) {
  return (
    <div className="rounded-lg border border-border bg-bg-card p-5 shadow-[0_1px_3px_rgba(0,0,0,.3)]">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </div>
      <div className="text-[28px] font-bold text-text-primary">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-text-secondary">{sub}</div>}
    </div>
  );
}
