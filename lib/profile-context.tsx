import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getProfile, updateProfile as dbUpdate, type Profile } from './db';
import { cycleDoseUnitPref, type DoseUnitPref } from './dose-format';

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

/**
 * Convenience hook: reads the global dose-unit preference and exposes
 * setters. The profile field is always one of 'auto' | 'mcg' | 'mg';
 * defaults to 'auto' before the profile row has loaded.
 */
export function useDoseUnitPref(): {
  pref: DoseUnitPref;
  set: (next: DoseUnitPref) => Promise<void>;
  cycle: () => Promise<DoseUnitPref>;
} {
  const { profile, update } = useContext(ProfileCtx);
  const pref: DoseUnitPref = (profile?.dose_unit_pref as DoseUnitPref | undefined) ?? 'auto';
  return useMemo(
    () => ({
      pref,
      set: async (next) => {
        await update({ dose_unit_pref: next });
      },
      cycle: async () => {
        const next = cycleDoseUnitPref(pref);
        await update({ dose_unit_pref: next });
        return next;
      },
    }),
    [pref, update],
  );
}
