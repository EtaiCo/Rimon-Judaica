import { useAuth } from "../../auth/AuthContext";

/** Thin wrapper so admin code only reaches for auth via a single hook. */
export function useAdminAuth() {
  const { accessToken, customer, clearSession } = useAuth();
  return { accessToken, customer, clearSession };
}
