import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface AdAccount {
  id: string;
  accountId: string;
  name: string;
  currency?: string;
}

interface MetaUser { id: string; name: string; }

interface MetaConnection {
  isConnected: boolean;
  needsConnection: boolean;
  accounts: AdAccount[];
  allAccounts: AdAccount[];
  hasAccountFilter: boolean;
  metaUser: MetaUser | null;
  isLoading: boolean;
  error: string | null;
}

interface MetaConnectionData {
  isConnected: boolean;
  needsConnection: boolean;
  accounts: AdAccount[];
  metaUser: MetaUser | null;
}

const globalCache = {
  data: null as MetaConnectionData | null,
  timestamp: 0,
  pendingPromise: null as Promise<MetaConnectionData | null> | null,
};
const CACHE_MS = 5 * 60 * 1000;
const STORAGE_KEY = 'roy:meta-oauth-result';

function isCacheValid() { return globalCache.data && Date.now() - globalCache.timestamp < CACHE_MS; }

export function useUserMetaConnection(redirectPath = '/marketing/trafego-pago') {
  const { user } = useAuth();
  const mountedRef = useRef(true);
  const [connection, setConnection] = useState<MetaConnection>({
    isConnected: globalCache.data?.isConnected ?? false,
    needsConnection: globalCache.data?.needsConnection ?? true,
    accounts: globalCache.data?.accounts ?? [],
    allAccounts: globalCache.data?.accounts ?? [],
    hasAccountFilter: false,
    metaUser: globalCache.data?.metaUser ?? null,
    isLoading: !isCacheValid(),
    error: null,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string> | null>(null);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const loadSelected = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('user_meta_selected_accounts').select('ad_account_id').eq('user_id', user.id);
    if (data && data.length > 0) setSelectedIds(new Set(data.map((r: any) => r.ad_account_id)));
    else setSelectedIds(null);
  }, [user]);

  useEffect(() => { loadSelected(); }, [loadSelected]);

  useEffect(() => {
    setConnection(prev => {
      const all = prev.allAccounts;
      if (!all.length) return prev;
      if (!selectedIds || selectedIds.size === 0) return { ...prev, accounts: all, hasAccountFilter: false };
      return { ...prev, accounts: all.filter(a => selectedIds.has(a.id)), hasAccountFilter: true };
    });
  }, [selectedIds]);

  const fetchAccounts = useCallback(async (force = false) => {
    if (!user) { setConnection(p => ({ ...p, isLoading: false, needsConnection: true })); return; }
    if (!force && isCacheValid()) {
      const d = globalCache.data!;
      setConnection(p => ({ ...p, isConnected: d.isConnected, needsConnection: d.needsConnection, accounts: d.accounts, allAccounts: d.accounts, metaUser: d.metaUser, isLoading: false, error: null }));
      return;
    }
    if (globalCache.pendingPromise) {
      try { await globalCache.pendingPromise; } catch {}
      return;
    }
    setConnection(p => ({ ...p, isLoading: true, error: null }));
    globalCache.pendingPromise = (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-user-meta-accounts');
        if (error) {
          if (globalCache.data?.isConnected) return globalCache.data;
          return { isConnected: false, needsConnection: true, accounts: [], metaUser: null };
        }
        const result: MetaConnectionData = data?.success
          ? { isConnected: true, needsConnection: false, accounts: data.accounts || [], metaUser: data.metaUser || null }
          : { isConnected: false, needsConnection: true, accounts: [], metaUser: null };
        globalCache.data = result;
        globalCache.timestamp = Date.now();
        return result;
      } catch {
        return { isConnected: false, needsConnection: true, accounts: [], metaUser: null };
      } finally {
        globalCache.pendingPromise = null;
      }
    })();
    const result = await globalCache.pendingPromise;
    if (mountedRef.current && result) {
      setConnection(p => ({ ...p, isConnected: result.isConnected, needsConnection: result.needsConnection, accounts: result.accounts, allAccounts: result.accounts, metaUser: result.metaUser, isLoading: false }));
    }
  }, [user]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const connectMeta = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.functions.invoke('generate-oauth-state', { body: { redirect_path: redirectPath, force_reauth: false } });
      if (error || !data?.oauth_url) {
        setConnection(p => ({ ...p, error: 'Erro ao iniciar autenticação' }));
        return;
      }
      window.location.href = data.oauth_url;
    } catch {
      setConnection(p => ({ ...p, error: 'Erro ao iniciar autenticação' }));
    }
  }, [user, redirectPath]);

  const disconnectMeta = useCallback(async () => {
    try {
      const { error } = await supabase.functions.invoke('disconnect-meta');
      if (error) return false;
      globalCache.data = null;
      globalCache.timestamp = 0;
      setConnection({ isConnected: false, needsConnection: true, accounts: [], allAccounts: [], hasAccountFilter: false, metaUser: null, isLoading: false, error: null });
      return true;
    } catch {
      return false;
    }
  }, []);

  const refreshSelectedAccounts = useCallback(() => { loadSelected(); }, [loadSelected]);

  // Handle OAuth return params (?connected=true or ?error=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true') {
      globalCache.data = null; globalCache.timestamp = 0;
      fetchAccounts(true);
      params.delete('connected');
      const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
      window.history.replaceState({}, '', newUrl);
    } else if (params.get('error')) {
      const err = params.get('error');
      setConnection(p => ({ ...p, error: err }));
      params.delete('error');
      const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, [fetchAccounts]);

  return {
    ...connection,
    connectMeta,
    disconnectMeta,
    refreshSelectedAccounts,
  };
}
