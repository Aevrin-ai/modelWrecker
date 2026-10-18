import type { Database, Row } from "../types/deps";
import { namedQueries } from "../database/namedQueries";

// the ids of Razorpay webhook events already applied, so a redelivered event is skipped
export function billingEventsRepository(db: Database) {
  const events = db.table("billing_events");
  return namedQueries("billingEvents", {
    exists: async (eventId: string): Promise<boolean> => (await events.count({ eq: { event_id: eventId } })) > 0,
    insert: (eventId: string, event: string): Promise<Row> => events.insert({ event_id: eventId, event }),
  });
}
