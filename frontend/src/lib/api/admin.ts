import { api } from "./client";

export interface AdminStats {
  total_users: number;
  active_users: number;
  superusers: number;
  total_global_books: number;
  total_user_books: number;
  total_notes: number;
  public_notes: number;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_superuser: boolean;
  preferred_language: string;
  created_at: string;
  updated_at: string;
  user_books_count: number;
  notes_count: number;
}

export interface AdminUserUpdateData {
  is_active?: boolean;
  is_superuser?: boolean;
  full_name?: string;
}

export const adminApi = {
  getStats: () =>
    api.get<AdminStats>("/v1/admin/stats"),

  getUsers: (q?: string, limit = 50, offset = 0) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    return api.get<AdminUser[]>(`/v1/admin/users?${params.toString()}`);
  },

  updateUser: (userId: string, data: AdminUserUpdateData) =>
    api.patch<AdminUser>(`/v1/admin/users/${userId}`, data),

  resetPassword: (userId: string, newPassword: string) =>
    api.post<{ detail: string }>(`/v1/admin/users/${userId}/reset-password`, {
      new_password: newPassword,
    }),

  deleteUser: (userId: string) =>
    api.delete<void>(`/v1/admin/users/${userId}`),
};
