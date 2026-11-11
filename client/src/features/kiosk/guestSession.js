export const GUEST_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

// Memory-only state for the future kiosk surface. Does not touch account
// storage, cancel orders, invalidate retained proof or perform network calls.
export function createGuestSession({ onChange = () => {}, now = Date.now, schedule = setTimeout, cancel = clearTimeout } = {}) {
  let cart = [], proof = null, generation = 0, timer, disposed = false;
  let deadline = now() + GUEST_IDLE_TIMEOUT_MS;
  const snapshot = () => ({ cart: structuredClone(cart), proof: proof && { ...proof }, generation });
  const emit = () => onChange(snapshot());
  const arm = () => {
    cancel(timer);
    if (!disposed) timer = schedule(expireIfIdle, Math.max(0, deadline - now()));
  };
  function reset() {
    if (disposed) return;
    cart = []; proof = null; generation++;
    deadline = now() + GUEST_IDLE_TIMEOUT_MS;
    arm(); emit();
  }
  function expireIfIdle() {
    if (disposed) return true;
    if (now() >= deadline) { reset(); return true; }
    arm(); return false;
  }
  function activity() {
    if (disposed) return;
    // A throttled background timer must not let activity revive expired state.
    expireIfIdle();
    deadline = now() + GUEST_IDLE_TIMEOUT_MS; arm();
  }
  arm();
  return {
    activity, reset, expireIfIdle,
    read() { expireIfIdle(); return snapshot(); },
    setCart(items) {
      if (disposed) return;
      activity(); cart = structuredClone(items); emit();
    },
    beginSubmission() { expireIfIdle(); return generation; },
    acceptProof(submissionGeneration, value) {
      expireIfIdle();
      if (disposed || submissionGeneration !== generation) return false;
      proof = { reference: value.reference, credential: value.credential, intentId: value.intentId || null, expiresAt: value.expiresAt || null };
      // Network responses are not user activity and must not prolong exposure.
      emit(); return true;
    },
    dispose() {
      if (disposed) return;
      cancel(timer); cart = []; proof = null; generation++; disposed = true;
      emit();
    },
  };
}

// Attach only to the kiosk, not the staff app. Caller unsubscribes on unmount.
export function attachGuestSessionEvents(target, session) {
  const pageTarget = target.defaultView || target;
  const activity = () => session.activity();
  const visibility = () => session.expireIfIdle();
  const leave = () => session.reset();
  for (const event of ["pointerdown", "keydown", "input"]) target.addEventListener(event, activity);
  target.addEventListener("visibilitychange", visibility);
  pageTarget.addEventListener("pagehide", leave);
  return () => {
    for (const event of ["pointerdown", "keydown", "input"]) target.removeEventListener(event, activity);
    target.removeEventListener("visibilitychange", visibility);
    pageTarget.removeEventListener("pagehide", leave);
    session.dispose();
  };
}
