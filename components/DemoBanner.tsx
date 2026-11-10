import { DEMO_DATA_NOTICE } from "@/data/demo/athletes";

interface DemoBannerProps {
  message?: string;
}

export function DemoBanner({ message = DEMO_DATA_NOTICE }: DemoBannerProps) {
  return (
    <div
      role="note"
      className="mb-4 rounded-md border-2 border-dashed border-amber-700 bg-amber-50 px-4 py-2 text-sm text-amber-950"
    >
      <strong>DEMOSTRACIÓN · </strong>
      {message}
    </div>
  );
}
