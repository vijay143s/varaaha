import { useAuthContext } from "../store/auth-context.js";

export function useAuth() {
  return useAuthContext();
}
