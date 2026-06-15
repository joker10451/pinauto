import { Timestamp } from "firebase-admin/firestore";

export type FunnelStage =
  | "joined"
  | "lead_delivered"
  | "follow_up_sent"
  | "premium_offered"
  | "paid";

export type Gateway = "boosty" | "crypto";
export type TxStatus = "pending" | "paid" | "failed" | "expired";

export interface UserDoc {
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  language_code: string | null;
  source: string | null; // e.g. "pin_tracker"
  joined_at: Timestamp;
  funnel_stage: FunnelStage;
  premium_status: boolean;
  follow_up_due_at: Timestamp | null;
  follow_up_sent_at: Timestamp | null;
  last_invoice_id: string | null;
}

export interface TransactionDoc {
  tx_id: string; // gateway-side id
  telegram_id: number;
  amount: number;
  currency: string;
  gateway: Gateway;
  status: TxStatus;
  created_at: Timestamp;
  updated_at: Timestamp;
  raw?: unknown;
}
