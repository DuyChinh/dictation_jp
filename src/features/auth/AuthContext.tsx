import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiUrl } from "../../shared/env";
import { adoptLocalData, clearAccountData } from "../../shared/storage/accountData";

export interface User {
  _id: string;
  email: string;
  displayName: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithToken: (token: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
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

  const logout = () => {
    localStorage.removeItem("token");
    clearAccountData();
    setUser(null);
    // Pages hold the signed-out user's progress in memory; start them over from the cleared storage.
    window.location.reload();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithToken, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
