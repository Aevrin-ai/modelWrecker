import type { Database, Row } from "../types/deps";
import { namedQueries } from "../database/namedQueries";

interface CreditChange {
  owner: string;
  deltaPaise: number;
  reason: string;
  actor: string;
}

export function creditLedgerRepository(db: Database) {
  const ledger = db.table("credit_ledger");
  return namedQueries("creditLedger", {
    listNewestForOwner: (owner: string, limit: number): Promise<Row[]> =>
      ledger.select({ eq: { owner_id: owner }, order: { column: "created_at", ascending: false }, limit }),
    // adjust_credit changes the balance and writes the ledger line in one transaction; it returns the new balance
    adjust: ({ owner, deltaPaise, reason, actor }: CreditChange): Promise<unknown> =>
      db.rpc("adjust_credit", { p_owner: owner, p_delta: deltaPaise, p_reason: reason, p_actor: actor }),
  });
}
