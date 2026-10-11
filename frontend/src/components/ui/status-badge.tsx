import { STATUS_TONES, type StatusName } from "@/constants/status-badges";
import { Badge } from "./badge";

type Props = {
  status: StatusName;
  className?: string;
};

// Shows a status with the exact name from the proposal and its agreed tone.
export function StatusBadge({ status, className }: Props) {
  return (
    <Badge tone={STATUS_TONES[status]} className={className}>
      {status}
    </Badge>
  );
}
