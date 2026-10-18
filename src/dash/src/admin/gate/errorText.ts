// an API failure is always an Error with a safe message; anything else means the request never finished
export const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "The request did not reach the server. Check your connection and try again.";
