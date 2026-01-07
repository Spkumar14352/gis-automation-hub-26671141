import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  full_name?: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'gis_hub_auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const getBackendUrl = () => {
    const url = localStorage.getItem('python-backend-url') || '';
    // Remove any accidental quotes that may have been stored
    return url.replace(/^["']|["']$/g, '').trim();
  };

  useEffect(() => {
    // Check for stored auth on mount
    const storedAuth = localStorage.getItem(AUTH_STORAGE_KEY);
    if (storedAuth) {
      try {
        const { user: storedUser, token: storedToken } = JSON.parse(storedAuth);
        setUser(storedUser);
        setToken(storedToken);
        
        // Verify token is still valid
        const backendUrl = getBackendUrl();
        if (backendUrl && storedToken) {
          fetch(`${backendUrl}/auth/me`, {
            headers: { 'Authorization': `Bearer ${storedToken}` }
          })
            .then(res => {
              if (!res.ok) {
                // Token expired or invalid
                localStorage.removeItem(AUTH_STORAGE_KEY);
                setUser(null);
                setToken(null);
              }
            })
            .catch(() => {
              // Backend not available, keep local state
            });
        }
      } catch {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    const backendUrl = getBackendUrl();
    if (!backendUrl) {
      return { error: new Error('Python backend URL not configured. Go to Settings to configure it.') };
    }

    try {
      const response = await fetch(`${backendUrl}/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: new Error(data.detail || 'Sign in failed') };
      }

      setUser(data.user);
      setToken(data.token);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: data.user, token: data.token }));
      
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Network error') };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    const backendUrl = getBackendUrl();
    if (!backendUrl) {
      return { error: new Error('Python backend URL not configured. Go to Settings to configure it.') };
    }

    try {
      const response = await fetch(`${backendUrl}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: new Error(data.detail || 'Sign up failed') };
      }

      setUser(data.user);
      setToken(data.token);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ user: data.user, token: data.token }));
      
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err : new Error('Network error') };
    }
  };

  const signOut = async () => {
    const backendUrl = getBackendUrl();
    if (backendUrl && token) {
      try {
        await fetch(`${backendUrl}/auth/signout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      } catch {
        // Ignore errors, still sign out locally
      }
    }
    
    setUser(null);
    setToken(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
