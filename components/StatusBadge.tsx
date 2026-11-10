import type { DailyRecordStatus } from "@/types";
import { STATUS_INFO } from "@/lib/status";

export function StatusBadge({ status }: { status: DailyRecordStatus }) {
  const info = STATUS_INFO[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${info.className}`}
    >
      <span aria-hidden="true">{info.symbol}</span>
      {info.label}
    </span>
  );
}
