export function logger(req, res, next) {
  const now = new Date().toISOString();

  res.on("finish", () => {
    console.log(
      `[${now}] ${req.method} ${req.baseUrl || ""}${req.route?.path || "<unmatched>"} ${res.statusCode}`,
    );
  });

  res.on("error", () => {
    console.error(`[${now}] Request response error`);
  });

  next();
}
