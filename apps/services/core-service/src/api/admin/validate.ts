import type { RequestHandler } from "express";
import { z, type ZodTypeAny } from "zod";

export type ValidationSchemas = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

export type ValidatedRequest<S extends ValidationSchemas> = {
  body: S["body"] extends ZodTypeAny ? z.infer<S["body"]> : unknown;
  query: S["query"] extends ZodTypeAny ? z.infer<S["query"]> : unknown;
  params: S["params"] extends ZodTypeAny ? z.infer<S["params"]> : unknown;
};

function firstIssueMessage(err: z.ZodError): string {
  const issue = err.issues[0];
  if (!issue) return "invalid_request";
  const path = issue.path.length > 0 ? issue.path.join(".") : "input";
  return `${path}: ${issue.message}`;
}

/**
 * Express middleware that validates `body`, `query` and/or `params`
 * with the provided Zod schemas. On success, the parsed values replace
 * the originals on the request object so route handlers operate on
 * typed, stripped data.
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, res, next) => {
    try {
      if (schemas.body) {
        const parsed = schemas.body.parse(req.body ?? {});
        req.body = parsed;
      }
      if (schemas.query) {
        const parsed = schemas.query.parse(req.query ?? {});
        (req as unknown as { query: unknown }).query = parsed;
      }
      if (schemas.params) {
        const parsed = schemas.params.parse(req.params ?? {});
        (req as unknown as { params: unknown }).params = parsed;
      }
      next();
    } catch (e) {
      if (e instanceof z.ZodError) {
        res.status(400).json({ error: firstIssueMessage(e) });
        return;
      }
      next(e);
    }
  };
}
