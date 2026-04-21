import type { CustomerRole, CustomerStatus } from "@rimon/shared-types";

declare global {
  namespace Express {
    interface Request {
      /** Identity bundle resolved by `requireCustomerAuth` from a fresh DB read. */
      customer?: {
        id: string;
        role: CustomerRole;
        status: CustomerStatus;
        email: string;
      };
      /** JWT id, set by auth middleware. */
      jti?: string;
      /** Per-request correlation id. Set by the request-id middleware. */
      requestId?: string;
    }
  }
}

export {};
