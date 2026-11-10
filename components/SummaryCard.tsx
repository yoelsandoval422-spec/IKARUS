interface SummaryCardProps {
  title: string;
  value: string | number;
  hint?: string;
}

export function SummaryCard({ title, value, hint }: SummaryCardProps) {
  return (
    <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="mt-1 text-3xl font-bold text-brand-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-600">{hint}</p> : null}
    </div>
  );
}
