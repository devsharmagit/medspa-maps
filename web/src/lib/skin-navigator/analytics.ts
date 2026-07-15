import pool from "@/lib/db";
import type { NavigatorEvent } from "./schema";

function isMissingTableError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "42P01"
  );
}

export async function recordNavigatorEvent(event: NavigatorEvent): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO ai_navigator_events (session_id, event_name, step, payload)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [
        event.sessionId ?? null,
        event.eventName,
        event.step ?? null,
        JSON.stringify(event.payload ?? {}),
      ]
    );
  } catch (err) {
    if (isMissingTableError(err)) {
      console.warn("[skin-navigator] analytics skipped; ai_navigator_events is missing");
      return;
    }
    throw err;
  }
}
