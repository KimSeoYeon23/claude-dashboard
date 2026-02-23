interface Props {
  label: string;
  value: string;
  sub?: string;
}

export default function StatCard({ label, value, sub }: Props) {
  return (
    <div className="rounded-xl bg-bg-card p-5">
      <div className="mb-1 text-xs text-text-muted">
        {label}
      </div>
      <div className="text-2xl font-bold text-text-primary">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-text-secondary">{sub}</div>}
    </div>
  );
}
