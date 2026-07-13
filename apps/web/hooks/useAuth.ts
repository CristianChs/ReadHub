"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { authService } from "@readhub/services";
import { getErrorMessage } from "@/lib/utils";
import type { LoginInput, RegisterInput } from "@readhub/types";
import type { Profile } from "@readhub/types";

// ============================================================================
// useAuth — sesión de autenticación y perfil del usuario actual.
// Consume únicamente auth.service; no realiza queries directas a Supabase.
// ============================================================================

interface UseAuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<UseAuthState>({
    user: null,
    profile: null,
    loading: true,
    error: null,
  });

  const loadProfile = useCallback(
    async (user: User | null) => {
      if (!user) {
        setState({ user: null, profile: null, loading: false, error: null });
        return;
      }
      try {
        const profile = await authService.getProfile(supabase, user.id);
        setState({ user, profile, loading: false, error: null });
      } catch (error) {
        setState({
          user,
          profile: null,
          loading: false,
          error: getErrorMessage(error),
        });
      }
    },
    [supabase],
  );

  // Sesión inicial + suscripción a cambios (login/logout en otra pestaña,
  // expiración de token, etc.).
  useEffect(() => {
    let active = true;

    authService.getCurrentUser(supabase).then((user) => {
      if (active) void loadProfile(user);
    });

    const unsubscribe = authService.onAuthChange(supabase, (user) => {
      void loadProfile(user);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [supabase, loadProfile]);

  const register = useCallback(
    async (input: RegisterInput) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const data = await authService.register(supabase, input);
        await loadProfile(data.user ?? null);
        return data;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: getErrorMessage(error),
        }));
        throw error;
      }
    },
    [supabase, loadProfile],
  );

  const login = useCallback(
    async (input: LoginInput) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const data = await authService.login(supabase, input);
        await loadProfile(data.user);
        return data;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: getErrorMessage(error),
        }));
        throw error;
      }
    },
    [supabase, loadProfile],
  );

  const logout = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      await authService.logout(supabase);
      setState({ user: null, profile: null, loading: false, error: null });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: getErrorMessage(error),
      }));
      throw error;
    }
  }, [supabase]);

  return {
    user: state.user,
    profile: state.profile,
    isAuthenticated: state.user !== null,
    loading: state.loading,
    error: state.error,
    register,
    login,
    logout,
  };
}
