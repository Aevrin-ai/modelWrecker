/** A database value as a string; null and undefined become "". */
export const str = (v: unknown) => (v == null ? "" : String(v));
