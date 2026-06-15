import { Timestamp } from "firebase-admin/firestore";

export type ContentStatus = "pending" | "publishing" | "published" | "confirmed" | "error";

export interface ContentPlanDocument {
  id?: string;
  status: ContentStatus;
  pin_title: string;
  pin_description: string;
  media_url: string;
  destination_link: string;
  board_name?: string;
  perfluence_offer_id?: string;
  perfluence_ref_link?: string;
  deadline_at?: Timestamp;
  error_message?: string;
  error_screenshot_base64?: string;
  pin_url?: string;
  confirmation_screenshot?: string;
  published_at?: Timestamp;
  created_at: Timestamp;
  updated_at?: Timestamp;
}
