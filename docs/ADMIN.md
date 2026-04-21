# Admin Dashboard — Operations

This document covers bootstrap, security operations, and routine maintenance
for the `/admin` dashboard.

## Architecture in one page

- **Auth**: custom JWT issued by `@rimon/core-service`. The token payload is
  intentionally minimal — `{ sub, jti, ver }`. `role` and `status` are **never**
  trusted from the token; they are re-read from the `customers` table on every
  request by `requireCustomerAuth`. Admins receive shorter-lived tokens (2h).
- **Authorization**: `requireAdminAuth` is mounted once at `/api/admin` and
  wraps every admin route. A client-side `RequireAdmin` shell *additionally*
  hits `GET /api/admin/me` — the server-side check is authoritative.
- **Audit**: every admin HTTP write logs to `admin_activity_log` with IP,
  user agent, request ID, and a `diff` of before/after state. RPC writes add
  their own rows. All audit tables have append-only triggers so even the
  service role cannot `UPDATE`/`DELETE` them.
- **Sensitive actions**: refunds, role changes, suspensions, and deletes
  require `X-Sudo-Password` step-up and an `Idempotency-Key` header. Replays
  return the original response instead of executing twice.
- **Rate limiting**: `authLimiter` (login/register), `adminLimiter` (all of
  `/api/admin`), and `sensitiveLimiter` (step-up endpoints). Hits are logged
  to `security_events`.

## First-time bootstrap

1. **Apply migrations** to Supabase in order up through `020_seed_admin_example.sql`.
2. **Register yourself** through the regular storefront flow.
3. **Promote the account** via SQL (run as service role in the Supabase SQL
   editor). Bumping `jwt_version` invalidates any previously issued token so
   the client must re-login to pick up the new `role`:

   ```sql
   UPDATE customers
   SET role        = 'admin',
       jwt_version = jwt_version + 1
   WHERE email = lower('you@example.com');
   ```

4. **Log back in**. A `ניהול` link appears in the storefront header for
   admins. The admin bundle is lazy-loaded so non-admins never download it.

> ⚠ Never promote users directly from the UI of another admin without the
> step-up dialog. All role changes go through `promote_customer`/`demote_admin`
> RPCs which enforce the "can't demote last admin" invariant.

## Required environment variables

### `@rimon/core-service`

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET` | Primary signing key for admin/customer tokens. |
| `JWT_SECRET_PREVIOUS` | *Optional.* Previous secret accepted for verification only. Set during rotation, clear it after the max token TTL has elapsed. |
| `ADMIN_ALLOWED_IMAGE_HOSTS` | Comma-separated hostnames that admin product/category image URLs may point at. Defaults to the Supabase project host. |
| `NODE_ENV=production` | Enables strict error messages and hides stack traces. |
| `CORS_ORIGINS` | Comma-separated allowlist of storefront origins. |

### `@rimon/storefront`

| Variable | Purpose |
| --- | --- |
| `VITE_API_BASE_URL` | URL of `@rimon/core-service`. Left empty in dev so the Vite proxy handles it. |

## Routine security operations

### Revoke a single account's sessions

Bumping `jwt_version` forces any live JWT for that customer to fail
verification on the next request:

```sql
UPDATE customers
SET jwt_version = jwt_version + 1
WHERE id = '<customer-uuid>';
```

This is what `POST /api/auth/logout`, `suspend_customer`, and the UI's
"Revoke sessions" action do under the hood.

### Suspend a compromised admin

```sql
UPDATE customers
SET status      = 'suspended',
    jwt_version = jwt_version + 1
WHERE id = '<admin-uuid>';
```

The admin's live tokens fail within one request; any new login attempt is
blocked by `requireCustomerAuth` because `status = 'suspended'`.

### Rotate `JWT_SECRET`

1. Set `JWT_SECRET_PREVIOUS` to the current value.
2. Set `JWT_SECRET` to a new random 32+ byte string.
3. Deploy. Tokens signed with the old key continue to verify until they
   expire (max 2h for admins, 24h for customers).
4. After the grace window, remove `JWT_SECRET_PREVIOUS` and redeploy.

### Clean up old idempotency keys

`admin_idempotency_keys` is append-only but key rows older than 24 hours are
no longer referenced. Schedule this to run daily in Supabase (via pg_cron,
Edge Function, or manual):

```sql
SELECT cleanup_admin_idempotency_keys();
```

## Audit & monitoring

- **`/admin/activity-log`** — every admin-initiated action, filterable by
  action name.
- **`/admin/security-events`** — auth failures, rate-limit hits, denied
  admin access attempts, sudo failures.

Queries directly against the tables (read-only):

```sql
-- Top admin actions in the last 7 days
SELECT action, COUNT(*) FROM admin_activity_log
WHERE created_at >= now() - interval '7 days'
GROUP BY action ORDER BY COUNT(*) DESC;

-- Failed sudo attempts per admin
SELECT customer_id, COUNT(*)
FROM security_events
WHERE kind = 'sudo_failed' AND created_at >= now() - interval '7 days'
GROUP BY customer_id;
```

## Testing checklist before deploy

- [ ] Non-admin customer cannot access `/api/admin/me` (expect 403).
- [ ] Suspended admin gets 401 on next request after status change.
- [ ] Bumping `jwt_version` invalidates live tokens immediately.
- [ ] Refund flow requires sudo password and produces exactly one
      `admin_activity_log` + one `stock_audit_log`/ledger entry; repeating
      the request with the same `Idempotency-Key` returns the first response.
- [ ] Attempting to demote the only remaining admin fails with a clear
      `last_admin` error.
- [ ] Images for products must be on `ADMIN_ALLOWED_IMAGE_HOSTS` or the
      request is rejected.
