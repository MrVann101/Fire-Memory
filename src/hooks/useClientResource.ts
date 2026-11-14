"use client";

import { useEffect, useState } from "react";
import { useCallback } from "react";

export interface ClientResource<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  retry: () => void;
}

interface KeyedResource<T> extends ClientResource<T> {
  key: string;
  version: number;
}

export function useClientResource<T>(
  key: string,
  request: (signal: AbortSignal) => Promise<T>,
  debounceMs = 250
): ClientResource<T> {
  const [version, setVersion] = useState(0);
  const retry = useCallback(() => {
    setVersion((current) => current + 1);
  }, []);
  const [resource, setResource] = useState<KeyedResource<T>>({
    key,
    version: 0,
    data: null,
    isLoading: Boolean(key),
    error: null,
    retry,
  });

  useEffect(() => {
    if (!key) {
      return;
    }

    const controller = new AbortController();
    let active = true;

    const timeout = setTimeout(() => {
      void request(controller.signal)
        .then((data) => {
          if (active && !controller.signal.aborted) {
            setResource({
              key,
              version,
              data,
              isLoading: false,
              error: null,
              retry,
            });
          }
        })
        .catch((error: unknown) => {
          if (active && !controller.signal.aborted) {
            setResource({
              key,
              version,
              data: null,
              isLoading: false,
              error:
                error instanceof Error
                  ? error
                  : new Error("The request failed with an unknown error."),
              retry,
            });
          }
        });
    }, debounceMs);

    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [key, request, debounceMs, version, retry]);

  if (resource.key !== key || resource.version !== version) {
    return { data: null, isLoading: Boolean(key), error: null, retry };
  }

  return {
    data: resource.data,
    isLoading: resource.isLoading,
    error: resource.error,
    retry,
  };
}
