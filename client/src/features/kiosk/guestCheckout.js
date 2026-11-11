// Retain one immutable submission in kiosk memory until a definite outcome or
// session cleanup. Replays use the server's existing receipt/idempotency check.
export function createGuestCheckout(session, request, operationId = () => crypto.randomUUID()) {
  let pending = null;
  return {
    async submit({ signal } = {}) {
      const before = session.read(), generation = before.generation;
      if (!before.cart.length) throw new Error("Add products before submitting an order.");
      if (pending?.generation !== generation) pending = null;
      if (!pending) {
        const proof = await request("/intents", { method: "POST", body: {}, signal });
        if (typeof proof?.intentId !== "string" || !proof.intentId || typeof proof.credential !== "string" || !proof.credential || !Number.isFinite(Date.parse(proof.expiresAt))) throw new Error("Guest ordering returned invalid guest access. Retry shortly.");
        if (!session.acceptProof(generation, { ...proof, reference: "" })) return null;
        pending = { generation, proof, uncertain: false, body: { intentId: proof.intentId, operationId: operationId(), items: before.cart.map(({ product, quantity, size }) => ({ product, quantity, ...(size ? { size } : {}) })) } };
      }
      const attempt = pending;
      try {
        const result = await request("/orders", { method: "POST", body: attempt.body, credential: attempt.proof.credential, signal });
        if (typeof result?.reference !== "string" || !result.reference || typeof result.orderStatus !== "string") throw new Error("Guest ordering returned an invalid confirmation. Check status or retry the same submission.");
        if (!session.acceptProof(generation, { ...attempt.proof, reference: result.reference })) return null;
        pending = null;
        return result;
      } catch (error) {
        // A denial of a replay cannot prove the ORIGINAL request did not commit.
        const uncertain = attempt.uncertain || !error.status || error.status >= 500 || error.operationOutcome === "indeterminate";
        attempt.uncertain = uncertain;
        // A definitive denial permits a fresh intent on the next explicit try.
        if (!uncertain && pending === attempt) pending = null;
        throw Object.assign(error, { uncertain });
      }
    },
    reset() { pending = null; },
  };
}
