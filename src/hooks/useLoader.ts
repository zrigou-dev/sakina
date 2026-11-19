import { useCallback, useEffect, useEffectEvent, useState, type DependencyList } from 'react';

import { useDataVersion } from '@/runtime/AppProvider';

export interface LoaderState<T> {
  readonly data: T | undefined;
  readonly error: unknown;
  readonly loading: boolean;
  readonly reload: () => void;
}

const ids = new WeakMap<object, number>();
let nextId = 1;
/** Stable identity token for objects/functions, so dependency lists can be compared as strings. */
function token(v: unknown): string {
  if ((typeof v === 'object' && v !== null) || typeof v === 'function') {
    let id = ids.get(v as object);
    if (!id) {
      id = nextId++;
      ids.set(v as object, id);
    }
    return `#${id}`;
  }
  return `${typeof v}:${String(v)}`;
}

/**
 * Runs an async loader on mount, when deps change, and whenever user data changes
 * (bumpDataVersion). Keeps the previous data while reloading to avoid flicker.
 * `loading` is derived (the settled key differs from the requested key), so no state
 * is set synchronously inside the effect.
 */
export function useLoader<T>(fn: () => Promise<T>, deps: DependencyList): LoaderState<T> {
  const version = useDataVersion();
  const [tick, setTick] = useState(0);
  const key = `${deps.map(token).join('|')}|v${version}|t${tick}`;
  const [state, setState] = useState<{ key: string | null; data: T | undefined; error: unknown }>({ key: null, data: undefined, error: null });
  const load = useEffectEvent(fn);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => !cancelled && setState({ key, data, error: null }))
      .catch((error: unknown) => {
        if (__DEV__) console.warn('[useLoader]', error);
        if (!cancelled) setState((s) => ({ key, data: s.data, error }));
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data: state.data, error: state.error, loading: state.key !== key, reload };
}
