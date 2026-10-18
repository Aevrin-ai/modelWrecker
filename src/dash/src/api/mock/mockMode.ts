// a small artificial latency keeps loading and skeleton states visible
const LATENCY_MS = 350;
const MODE_KEY = "aevrin-mock-mode";

type MockMode = "live" | "error" | "empty";

// ?mock=error fails every call, ?mock=empty empties every list, ?mock=live goes back; kept for the tab session
export function getMockMode(): MockMode {
  try {
    const requestedMode = new URLSearchParams(window.location.search).get("mock");
    if (requestedMode === "error" || requestedMode === "empty" || requestedMode === "live") {
      sessionStorage.setItem(MODE_KEY, requestedMode);
      return requestedMode;
    }
    const storedMode = sessionStorage.getItem(MODE_KEY);
    if (storedMode === "error" || storedMode === "empty") return storedMode;
  } catch {
    // storage may be blocked, so fall back to normal mock data
    return "live";
  }
  return "live";
}

export function delay<T>(value: T, ms = LATENCY_MS): Promise<T> {
  const mockMode = getMockMode();
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      if (mockMode === "error") reject(new Error("The control plane did not respond."));
      else resolve(value);
    }, ms),
  );
}

export function delayList<T>(items: T[]): Promise<T[]> {
  return delay(getMockMode() === "empty" ? [] : items);
}

export function delayOne<T>(item: T | null | undefined): Promise<T | null> {
  return delay(getMockMode() === "empty" ? null : (item ?? null));
}
