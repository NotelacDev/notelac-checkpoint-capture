import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';

/** Where a store keeps its JSON between app launches. */
export type Persistence = {
  load: () => Promise<string | null>;
  save: (json: string) => Promise<void>;
};

export const asyncStorage = (key: string): Persistence => ({
  load: () => AsyncStorage.getItem(key),
  save: (json) => AsyncStorage.setItem(key, json),
});

/** For large data (the capture index) — a JSON file in the app's document folder. */
export const jsonFile = (name: string): Persistence => ({
  load: async () => {
    const f = new File(Paths.document, name);
    return f.exists ? f.text() : null;
  },
  save: async (json) => {
    const f = new File(Paths.document, name);
    if (!f.exists) f.create({ intermediates: true });
    await f.write(json);
  },
});

/**
 * Tiny global store: plain object state, React hook via useSyncExternalStore,
 * debounced persistence. Selectors must return primitives or stable references.
 */
export function createStore<T extends object>(initial: T, persistence?: Persistence, serialize?: (s: T) => unknown) {
  let state = initial;
  let hydrated = !persistence;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const notify = () => listeners.forEach((l) => l());

  const persist = () => {
    if (!persistence || !hydrated) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      persistence.save(JSON.stringify(serialize ? serialize(state) : state)).catch((e) => console.warn('persist failed', e));
    }, 400);
  };

  const store = {
    get: () => state,
    set(patch: Partial<T> | ((s: T) => Partial<T>)) {
      const next = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...next };
      notify();
      persist();
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    async hydrate() {
      if (!persistence || hydrated) return;
      try {
        const raw = await persistence.load();
        if (raw) state = { ...initial, ...(JSON.parse(raw) as Partial<T>) };
      } catch (e) {
        console.warn('hydrate failed', e);
      }
      hydrated = true;
      notify();
    },
    isHydrated: () => hydrated,
    use<S>(selector: (s: T) => S): S {
      return useSyncExternalStore(store.subscribe, () => selector(state));
    },
  };
  return store;
}
