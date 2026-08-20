import { startLogin } from "@/const";
import { isExternalRuntime } from "@/lib/externalRuntime";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo, useState } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

function useManusAuth(options?: UseAuthOptions) {
  // Login is started via startLogin() in the effect below, only when we actually
  // navigate — never during render. startLogin() mints a one-time nonce + writes
  // the state cookie, so calling it per render would overwrite the cookie and
  // desync it from an in-flight login's `state`.
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const utils = trpc.useUtils();

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      // Clear the Preview auto-login token mirrored into sessionStorage, so
      // header-based sessions (Safari ITP / WebView) are logged out too. The
      // backend cookie is cleared by the logout mutation.
      try {
        sessionStorage.removeItem("manus-cookie");
      } catch {}
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    localStorage.setItem(
      "manus-runtime-user-info",
      JSON.stringify(meQuery.data)
    );
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (redirectPath && window.location.pathname === redirectPath) return;

    // Navigate at this moment only. startLogin() mints the nonce + cookie itself.
    if (redirectPath) {
      window.location.href = redirectPath;
    } else {
      startLogin();
    }
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
  };
}

function useSupabaseAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } = options ?? {};
  const [state, setState] = useState<{ user: { id: string; email: string | null; name: string } | null; loading: boolean; error: Error | null }>({
    user: null,
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    try {
      const { data, error } = await getSupabaseBrowserClient().auth.getUser();
      if (error) throw error;
      const displayName = data.user?.user_metadata.name ?? data.user?.user_metadata.full_name ?? data.user?.email ?? "Portfolio user";
      setState({ user: data.user ? { id: data.user.id, email: data.user.email ?? null, name: typeof displayName === "string" ? displayName : "Portfolio user" } : null, loading: false, error: null });
    } catch (error) {
      setState({ user: null, loading: false, error: error instanceof Error ? error : new Error("Не удалось проверить сессию Supabase.") });
    }
  }, []);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    void refresh();
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      const displayName = session?.user.user_metadata.name ?? session?.user.user_metadata.full_name ?? session?.user.email ?? "Portfolio user";
      setState({ user: session?.user ? { id: session.user.id, email: session.user.email ?? null, name: typeof displayName === "string" ? displayName : "Portfolio user" } : null, loading: false, error: null });
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  const logout = useCallback(async () => {
    const { error } = await getSupabaseBrowserClient().auth.signOut();
    if (error) throw error;
    setState({ user: null, loading: false, error: null });
  }, []);

  useEffect(() => {
    if (!redirectOnUnauthenticated || state.loading || state.user || typeof window === "undefined") return;
    if (redirectPath && window.location.pathname === redirectPath) return;
    window.location.href = redirectPath ?? "/auth/signin";
  }, [redirectOnUnauthenticated, redirectPath, state.loading, state.user]);

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    isAuthenticated: Boolean(state.user),
    refresh,
    logout,
  };
}

export function useAuth(options?: UseAuthOptions) {
  return isExternalRuntime ? useSupabaseAuth(options) : useManusAuth(options);
}
