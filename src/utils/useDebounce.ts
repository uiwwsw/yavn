import { useCallback, useEffect, useRef } from 'react';

const useDebounce = <T extends (...args: unknown[]) => void>(fn: T | undefined, delay: number = 300) => {
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      if (!fn) return;

      if (!delay) {
        fn(...args);
        return;
      }

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        fn(...args);
      }, delay);
    },
    [delay, fn],
  );
};

export default useDebounce;
