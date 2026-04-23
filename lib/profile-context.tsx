import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getProfile, updateProfile as dbUpdate, type Profile } from './db';

type Ctx = {
  profile: Profile | null;
  loaded: boolean;
  refresh: () => Promise<void>;
  update: (patch: Partial<Profile>) => Promise<void>;
};

const ProfileCtx = createContext<Ctx>({
  profile: null,
  loaded: false,
  refresh: async () => {},
  update: async () => {},
});

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const p = await getProfile();
    setProfile(p);
    setLoaded(true);
  }, []);

  const update = useCallback(
    async (patch: Partial<Profile>) => {
      await dbUpdate(patch);
      await refresh();
    },
    [refresh]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <ProfileCtx.Provider value={{ profile, loaded, refresh, update }}>
      {children}
    </ProfileCtx.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileCtx);
}
