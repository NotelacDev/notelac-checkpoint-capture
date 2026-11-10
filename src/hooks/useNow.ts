import { useEffect, useState } from 'react';

/** Current time (device clock + optional offset) that re-renders every `intervalMs`. */
export function useNow(intervalMs: number, offsetMs = 0) {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setT(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return t + offsetMs;
}
