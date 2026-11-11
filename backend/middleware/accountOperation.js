import { accountTransaction } from "../utils/accountTransaction.js";
import { lockAccountRealm, fenceAccountActor } from "../services/accountManagement.js";

export function accountOperation(handler) {
  const wrapped = async (req, res, next) => {
    if (["addDebt", "updateDebt", "deleteDebt"].includes(handler.name)) return handler(req, res, next);
    // Receipt ensure is now read-only for every role; issuance occurs only
    // inside the scoped, authorized sale-completion transaction.
    if (["GET", "HEAD"].includes(req.method)) return handler(req, res, next);
    try {
      const response = await accountTransaction(async session => {
        await lockAccountRealm(session);
        await fenceAccountActor(req.user, session, false);
        const buffer = { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
        await handler({ ...req, user: req.user, params: req.params, query: req.query, body: req.body, accountSession: session }, buffer, error => { if (error) throw error; });
        if (buffer.statusCode >= 400) throw Object.assign(new Error("Domain operation rejected"), { statusCode: buffer.statusCode, bufferedResponse: buffer });
        return buffer;
      });
      return res.status(response.statusCode).json(response.body);
    } catch (error) {
      if (error.bufferedResponse) return res.status(error.bufferedResponse.statusCode).json(error.bufferedResponse.body);
      return next(error);
    }
  };
  Object.defineProperty(wrapped, "name", { value: handler.name });
  return wrapped;
}
