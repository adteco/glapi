'use client';

export interface ClerkAuthSnapshot {
  isLoaded: boolean;
  orgId: string | null | undefined;
  userId: string | null | undefined;
}

const AUTH_LOAD_TIMEOUT_MS = 3000;
const AUTH_LOAD_POLL_MS = 25;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function waitForClerkAuthToLoad(
  getSnapshot: () => ClerkAuthSnapshot,
  timeoutMs = AUTH_LOAD_TIMEOUT_MS
): Promise<ClerkAuthSnapshot> {
  let snapshot = getSnapshot();

  if (snapshot.isLoaded) {
    return snapshot;
  }

  const deadline = Date.now() + timeoutMs;

  while (!snapshot.isLoaded && Date.now() < deadline) {
    await sleep(AUTH_LOAD_POLL_MS);
    snapshot = getSnapshot();
  }

  return snapshot;
}
