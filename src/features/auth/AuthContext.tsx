import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiUrl } from "../../shared/env";
import { adoptLocalData, clearAccountData } from "../../shared/storage/accountData";

export interface User {
  _id: string;
  email: string;
  displayName: string;
  avatar?: string;
  authProvider?: "local" | "google";
  hasPassword?: boolean;
  plan?: string;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
  updateProfile: (displayName: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** Takes a data URL of the already-resized picture. */
  updateAvatar: (image: string) => Promise<void>;
  removeAvatar: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(apiUrl("/api/auth/me"), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        await adoptLocalData(data.user._id, token, { fromGuest: false });
        setUser(data.user);
      } else {
        localStorage.removeItem("token");
        // An expired session counts as signing out; a server error doesn't.
        if (res.status === 401) clearAccountData();
        setUser(null);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch(apiUrl("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || "Login failed");
    }

    localStorage.setItem("token", data.token);
    await adoptLocalData(data.user._id, data.token, { fromGuest: true });
    setUser(data.user);
  };

  const register = async (email: string, password: string, displayName: string) => {
    const res = await fetch(apiUrl("/api/auth/register"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, displayName }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || "Registration failed");
    }

    localStorage.setItem("token", data.token);
    await adoptLocalData(data.user._id, data.token, { fromGuest: true });
    setUser(data.user);
  };

  const loginWithToken = async (token: string) => {
    localStorage.setItem("token", token);
    const res = await fetch(apiUrl("/api/auth/me"), {
      headers: { Authorization: `Bearer ${token}` },
    });
    
    if (res.ok) {
      const data = await res.json();
      await adoptLocalData(data.user._id, token, { fromGuest: true });
      setUser(data.user);
    } else {
      localStorage.removeItem("token");
      setUser(null);
      throw new Error("Failed to fetch user with provided token");
    }
  };

  /** Sends a signed-in request and takes the returned user as the current one. */
  const sendAccountUpdate = async (path: string, method: string, body?: unknown) => {
    const res = await fetch(apiUrl(path), {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token") ?? ""}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    // A proxy or an outdated server can answer with an HTML error page.
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.user) {
      // No server message: the page shows its own generic error.
      throw new Error(data?.error?.message || "");
    }
    setUser(data.user);
  };

  const updateProfile = (displayName: string) =>
    sendAccountUpdate("/api/auth/me", "PATCH", { displayName });

  const changePassword = (currentPassword: string, newPassword: string) =>
    sendAccountUpdate("/api/auth/change-password", "POST", { currentPassword, newPassword });

  const updateAvatar = (image: string) => sendAccountUpdate("/api/auth/avatar", "POST", { image });

  const removeAvatar = () => sendAccountUpdate("/api/auth/avatar", "DELETE");

  const logout = () => {
    localStorage.removeItem("token");
    clearAccountData();
    setUser(null);
    // Pages hold the signed-out user's progress in memory; start them over from the cleared storage.
    window.location.reload();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithToken, register, logout, updateProfile, changePassword, updateAvatar, removeAvatar }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
