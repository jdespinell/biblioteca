"use client";

import useSWR from "swr";
import { authApi, type User } from "@/lib/api/auth";

export function useAuth() {
  const { data: user, error, isLoading, mutate } = useSWR<User | null>(
    "/auth/me",
    async () => {
      try {
        return await authApi.me();
      } catch {
        return null;
      }
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60_000, // 1 minute
    }
  );

  const login = async (email: string, password: string) => {
    const loggedUser = await authApi.login({ email, password });
    await mutate(loggedUser, false);
    return loggedUser;
  };

  const logout = async () => {
    await authApi.logout();
    await mutate(null, false);
  };

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user && !error,
    error,
    login,
    logout,
    mutate,
  };
}
