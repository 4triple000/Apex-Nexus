import { createContext, useContext, type ReactNode } from 'react';
import { useAvatarStore, type AvatarStore } from '@/hooks/useAvatarStore';

const AvatarContext = createContext<AvatarStore | null>(null);

export function AvatarProvider({ children }: { children: ReactNode }) {
  const store = useAvatarStore();
  return <AvatarContext.Provider value={store}>{children}</AvatarContext.Provider>;
}

export function useAvatar(): AvatarStore {
  const ctx = useContext(AvatarContext);
  if (!ctx) throw new Error('useAvatar must be inside AvatarProvider');
  return ctx;
}
