import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

/** Hash a plaintext password for storage in `customers.password_hash`. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

/** Verify plaintext against a stored bcrypt hash. */
export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
