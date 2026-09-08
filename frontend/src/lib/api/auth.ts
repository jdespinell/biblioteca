import { api } from "./client";

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_superuser?: boolean;
  preferred_language: string;
  created_at: string;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name?: string;
  preferred_language?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export const authApi = {
  register: (data: RegisterData) =>
    api.post<User>("/v1/auth/register", data),

  login: (data: LoginData) =>
    api.post<User>("/v1/auth/login", data),

  logout: () =>
    api.post<void>("/v1/auth/logout"),

  me: () =>
    api.get<User>("/v1/auth/me", { skipRedirectOn401: true } as never),

  refresh: () =>
    api.post<User>("/v1/auth/refresh"),

  updateMe: (data: { full_name?: string; preferred_language?: string }) =>
    api.patch<User>("/v1/auth/me", data),
};
