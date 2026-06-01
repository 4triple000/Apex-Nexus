/**
 * Universal Block Data Hook
 * Connects any canvas block to its backend data source automatically.
 * Handles loading, polling, error states, and cache.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { getData, postData } from "./api";
import { getBlockDataConfig } from "./blockDataMap";

export interface BlockDataState<T> {
  data:     T | null;
  loading:  boolean;
  error:    string | null;
  refresh:  () => void;
  post:     (body: unknown) => Promise<unknown>;
}

export function useBlockData<T>(blockId: string): BlockDataState<T> {
  const config         = getBlockDataConfig(blockId);
  const [data, setData]       = useState<T | null>(null);
  const [loading, setLoading] = useState(config.endpoint !== "");
  const [error, setError]     = useState<string | null>(null);
  const pollRef               = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!config.endpoint) return;
    try {
      const result = await getData<T>(config.endpoint);
      setData(result);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [config.endpoint]);

  useEffect(() => {
    if (!config.endpoint) { setLoading(false); return; }
    load();
    if (config.pollMs) {
      pollRef.current = setInterval(load, config.pollMs);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load, config.pollMs, config.endpoint]);

  const post = useCallback(async (body: unknown) => {
    if (!config.endpoint) return;
    const result = await postData(config.endpoint, body);
    await load();
    return result;
  }, [config.endpoint, load]);

  return { data, loading, error, refresh: load, post };
}
