import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

// ── Cookie helpers ──

function setCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Strict${location.protocol === 'https:' ? '; Secure' : ''}`;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Strict${location.protocol === 'https:' ? '; Secure' : ''}`;
}

// ── Constants ──

const MAX_AGE = 86400; // 24 hours

// ── Auth context ──

interface AuthState {
  token: string | null;
  username: string | null;
  login: (token: string, username: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState>({
  token: null,
  username: null,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getCookie("token"));
  const [username, setUsername] = useState<string | null>(() => getCookie("username"));

  const logout = useCallback(() => {
    deleteCookie("token");
    deleteCookie("username");
    deleteCookie("token_expires");
    setToken(null);
    setUsername(null);
  }, []);

  const login = useCallback((t: string, u: string) => {
    const expires = new Date(Date.now() + MAX_AGE * 1000).toISOString();
    setCookie("token", t, MAX_AGE);
    setCookie("username", u, MAX_AGE);
    setCookie("token_expires", expires, MAX_AGE);
    setToken(t);
    setUsername(u);
  }, []);

  // Expiration check every 60 seconds
  useEffect(() => {
    if (!token) return;

    const checkExpiry = () => {
      const expiresStr = getCookie("token_expires");
      if (!expiresStr) {
        logout();
        window.location.href = "/login";
        return;
      }

      const expires = new Date(expiresStr).getTime();
      if (Date.now() >= expires) {
        // 백그라운드 탭이면 조용히 로그아웃 (confirm 팝업 차단 방지)
        if (document.hidden) {
          logout();
          return;
        }
        const extend = window.confirm("로그인이 만료되었습니다. 연장하시겠습니까?");
        if (extend) {
          const currentToken = getCookie("token");
          const currentUsername = getCookie("username");
          if (currentToken && currentUsername) {
            const newExpires = new Date(Date.now() + MAX_AGE * 1000).toISOString();
            setCookie("token", currentToken, MAX_AGE);
            setCookie("username", currentUsername, MAX_AGE);
            setCookie("token_expires", newExpires, MAX_AGE);
          }
        } else {
          logout();
          window.location.href = "/login";
        }
      }
    };

    const interval = setInterval(checkExpiry, 60_000);
    return () => clearInterval(interval);
  }, [token, logout]);

  return (
    <AuthContext.Provider value={{ token, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
