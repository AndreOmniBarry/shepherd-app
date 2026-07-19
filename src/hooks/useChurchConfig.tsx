'use client';
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import type { ChurchConfig } from '@/lib/church-config';
import { DEFAULT_CONFIG } from '@/lib/church-config';

type ChurchConfigContextType = {
  config: ChurchConfig;
  loading: boolean;
  reload: () => void;
};

const ChurchConfigContext = createContext<ChurchConfigContextType>({
  config: { ...DEFAULT_CONFIG, id: 'default' } as ChurchConfig,
  loading: true,
  reload: () => {},
});

export function ChurchConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ChurchConfig>({ ...DEFAULT_CONFIG, id: 'default' } as ChurchConfig);
  const [loading, setLoading] = useState(true);

  function load() {
    fetch('/api/settings/church-config', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => {
        if (data?.config) setConfig(data.config);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  return (
    <ChurchConfigContext.Provider value={{ config, loading, reload: load }}>
      {children}
    </ChurchConfigContext.Provider>
  );
}

export function useChurchConfig() {
  return useContext(ChurchConfigContext);
}

// Standalone hook for pages that don't use the provider
export function useChurchConfigStandalone() {
  const [config, setConfig] = useState<ChurchConfig>({ ...DEFAULT_CONFIG, id: 'default' } as ChurchConfig);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/settings/church-config', { credentials: 'include' })
      .then(r => r.json())
      .then(({ data }) => { if (data?.config) setConfig(data.config); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { config, loading };
}
