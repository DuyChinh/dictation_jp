import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import {
  adminFetch,
  getAdminToken,
  setAdminToken,
  UNAUTHORIZED_EVENT,
  type AdminAccount,
  type AdminArea,
} from "./api";

type AdminAuthValue = {
  admin: AdminAccount | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  /** Adopts a fresh session, e.g. after changing the password. */
  setSession: (token: string, admin: AdminAccount) => void;
  can: (area: AdminArea, need: "read" | "write") => boolean;
};

const AdminAuthContext = createContext<AdminAuthValue | undefined>(undefined);

type Session = { token: string; admin: AdminAccount };

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminAccount | null>(null);
  const [loading, setLoading] = useState(() => Boolean(getAdminToken()));

  useEffect(() => {
    if (!getAdminToken()) return;
    adminFetch<{ admin: AdminAccount }>("/auth/me")
      .then((d) => setAdmin(d.admin))
      .catch(() => setAdmin(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onUnauthorized = () => setAdmin(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const setSession = useCallback((token: string, next: AdminAccount) => {
    setAdminToken(token);
    setAdmin(next);
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const s = await adminFetch<Session>("/auth/login", { method: "POST", body: { username, password } });
      setSession(s.token, s.admin);
    },
    [setSession],
  );

  const logout = useCallback(() => {
    setAdminToken(null);
    setAdmin(null);
  }, []);

  const can = useCallback(
    (area: AdminArea, need: "read" | "write") => {
      const level = admin?.permissions[area] ?? "none";
      return need === "read" ? level !== "none" : level === "write";
    },
    [admin],
  );

  return (
    <AdminAuthContext.Provider value={{ admin, loading, login, logout, setSession, can }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
