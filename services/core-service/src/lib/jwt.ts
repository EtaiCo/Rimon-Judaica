import jwt, { type SignOptions } from "jsonwebtoken";

function getSecret(): string {
  const s = process.env.JWT_SECRET?.trim();
  if (!s) {
    // #region agent log
    fetch("http://127.0.0.1:7506/ingest/a221c478-ae81-4876-8cff-d369da88eb5b", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "7d53ed",
      },
      body: JSON.stringify({
        sessionId: "7d53ed",
        location: "services/core-service/src/lib/jwt.ts:getSecret",
        message: "JWT_SECRET missing at use time",
        data: {
          jwtRawLength: process.env.JWT_SECRET?.length ?? 0,
          nodeEnv: process.env.NODE_ENV,
        },
        timestamp: Date.now(),
        hypothesisId: "H3-H4",
        runId: "pre-fix",
      }),
    }).catch(() => {});
    // #endregion
    throw new Error(
      "Missing JWT_SECRET. Add it to services/core-service/.env (see .env.template).",
    );
  }
  return s;
}

export function signCustomerAccessToken(customerId: string, email: string): string {
  const secret = getSecret();
  const raw = process.env.JWT_EXPIRES_IN?.trim();
  const options: SignOptions = raw
    ? { expiresIn: raw as SignOptions["expiresIn"] }
    : { expiresIn: "7d" };
  return jwt.sign({ sub: customerId, email }, secret, options);
}

export function verifyCustomerAccessToken(
  token: string,
): { sub: string; email?: string } {
  const secret = getSecret();
  const decoded = jwt.verify(token, secret);
  if (typeof decoded !== "object" || decoded === null || !("sub" in decoded)) {
    throw new Error("Invalid token payload");
  }
  const o = decoded as { sub: string; email?: string };
  if (typeof o.sub !== "string" || !o.sub) {
    throw new Error("Invalid token subject");
  }
  return { sub: o.sub, email: typeof o.email === "string" ? o.email : undefined };
}
