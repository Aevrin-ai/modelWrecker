import type { Row } from "../types/deps";

/** The first row a query returns, or null when it returns none. */
export async function firstRow(rows: Promise<Row[]>): Promise<Row | null> {
  const [row] = await rows;
  return row ?? null;
}
