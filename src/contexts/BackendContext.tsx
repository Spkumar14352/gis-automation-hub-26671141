import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type BackendStatus = 'checking' | 'connected' | 'disconnected';

interface BackendContextType {
  status: BackendStatus;
  backendUrl: string;
  setBackendUrl: (url: string) => void;
  checkConnection: () => Promise<boolean>;
}

const BackendContext = createContext<BackendContextType | undefined>(undefined);

export function BackendProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<BackendStatus>('checking');
  const [backendUrl, setBackendUrlState] = useState(() => {
    return localStorage.getItem('pythonBackendUrl') || 'http://localhost:5000';
  });

  const setBackendUrl = useCallback((url: string) => {
    localStorage.setItem('pythonBackendUrl', url);
    setBackendUrlState(url);
  }, []);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (!backendUrl) {
      setStatus('disconnected');
      return false;
    }

    setStatus('checking');
    try {
      const response = await fetch(`${backendUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      const connected = response.ok;
      setStatus(connected ? 'connected' : 'disconnected');
      return connected;
    } catch {
      setStatus('disconnected');
      return false;
    }
  }, [backendUrl]);

  // Auto-check on startup and when URL changes
  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  return (
    <BackendContext.Provider value={{ status, backendUrl, setBackendUrl, checkConnection }}>
      {children}
    </BackendContext.Provider>
  );
}

export function useBackend() {
  const context = useContext(BackendContext);
  if (!context) {
    throw new Error('useBackend must be used within a BackendProvider');
  }
  return context;
}
