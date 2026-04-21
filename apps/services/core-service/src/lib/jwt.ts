import jwt, { type SignOptions, type Secret } from "jsonwebtoken";
import { nanoid } from "nanoid";

/** Issued JWT payload. Identification only — never carries role/status. */
export type CustomerJwtPayload = {
  sub: string;
  jti: string;
  ver: number;
};

const ADMIN_DEFAULT_EXPIRY = "2h";
const CUSTOMER_DEFAULT_EXPIRY = "7d";

function getSecret(): string {
  const s = process.env.JWT_SECRET?.trim();
  if (!s) {
    throw new Error(
      "Missing JWT_SECRET. Add it to apps/services/core-service/.env (see .env.template).",
    );
  }
  return s;
}

function getPreviousSecret(): string | null {
  const s = process.env.JWT_SECRET_PREVIOUS?.trim();
  return s && s.length > 0 ? s : null;
}

function chooseExpiry(opts?: { isAdmin?: boolean }): SignOptions["expiresIn"] {
  const explicit = process.env.JWT_EXPIRES_IN?.trim();
  if (explicit) {
    return explicit as SignOptions["expiresIn"];
  }
  return opts?.isAdmin ? ADMIN_DEFAULT_EXPIRY : CUSTOMER_DEFAULT_EXPIRY;
}

/**
 * Sign an access token. The token carries only identifying claims
 * (`sub`, `jti`, `ver`) — role/status are always re-read from the DB
 * by the auth middleware to prevent stale-claim privilege escalation.
 */
export function signCustomerAccessToken(
  customerId: string,
  jwtVersion: number,
  opts?: { isAdmin?: boolean },
): { token: string; jti: string } {
  const secret = getSecret();
  const jti = nanoid(21);
  const payload: CustomerJwtPayload = {
    sub: customerId,
    jti,
    ver: jwtVersion,
  };
  const token = jwt.sign(payload, secret as Secret, {
    expiresIn: chooseExpiry(opts),
  });
  return { token, jti };
}

/**
 * Verify an access token. Tries the current secret first, falls back to
 * `JWT_SECRET_PREVIOUS` during a rotation window. Returns the typed
 * payload on success; throws on any failure.
 */
export function verifyCustomerAccessToken(token: string): CustomerJwtPayload {
  const trySecrets: string[] = [getSecret()];
  const previous = getPreviousSecret();
  if (previous) {
    trySecrets.push(previous);
  }

  let lastError: unknown;
  for (const secret of trySecrets) {
    try {
      const decoded = jwt.verify(token, secret as Secret);
      if (typeof decoded !== "object" || decoded === null) {
        throw new Error("Invalid token payload");
      }
      const o = decoded as Record<string, unknown>;
      if (
        typeof o.sub !== "string" ||
        !o.sub ||
        typeof o.jti !== "string" ||
        !o.jti ||
        typeof o.ver !== "number" ||
        !Number.isFinite(o.ver) ||
        o.ver < 1
      ) {
        throw new Error("Invalid token claims");
      }
      return { sub: o.sub, jti: o.jti, ver: o.ver };
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Invalid token");
}
