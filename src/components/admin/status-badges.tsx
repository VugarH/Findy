import type { RunStatus } from "@/modules/admin/runs";
import type { StoreStatus } from "@/modules/admin/stores";
import { Badge, type BadgeTone } from "./ui";

const STORE_TONES: Record<StoreStatus, BadgeTone> = {
  ok: "good",
  failing: "bad",
  waiting: "info",
  off: "neutral",
  retired: "neutral",
};

export function StoreStatusBadge({ status, labels }: { status: StoreStatus; labels: Record<StoreStatus, string> }) {
  return <Badge tone={STORE_TONES[status]}>{labels[status]}</Badge>;
}

const RUN_TONES: Record<RunStatus, BadgeTone> = {
  running: "info",
  success: "good",
  partial: "neutral",
  failed: "bad",
  interrupted: "bad",
};

export function RunStatusBadge({ status, labels }: { status: RunStatus; labels: Record<RunStatus, string> }) {
  return <Badge tone={RUN_TONES[status]}>{labels[status]}</Badge>;
}
