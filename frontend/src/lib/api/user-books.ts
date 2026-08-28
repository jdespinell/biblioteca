import { api } from "./client";
import type { GlobalBook } from "./books";

export type BookStatus = "unread" | "reading" | "read" | "wishlist";

export interface UserBook {
  id: string;
  global_book: GlobalBook;
  status: BookStatus;
  rating: number | null;
  summary?: string | null;
  location: { id: string; name: string } | null;
  tags: string[];
  attachments: Attachment[];
  added_at: string;
  updated_at: string;
}

export interface Attachment {
  id: string;
  file_type: "pdf" | "image";
  original_filename: string;
  uploaded_at: string;
  download_url?: string;
}

export interface UserBookStats {
  total: number;
  unread: number;
  reading: number;
  read: number;
  wishlist: number;
}

export interface UserBookCreate {
  global_book_id: string;
  status?: BookStatus;
  location_id?: string;
  rating?: number;
  summary?: string;
  tags?: string[];
}

export interface UserBookUpdate {
  status?: BookStatus;
  location_id?: string | null;
  rating?: number | null;
  summary?: string | null;
  tags?: string[];
}

export interface UserBooksFilter {
  status?: BookStatus;
  exclude_wishlist?: boolean;
  location_id?: string;
  tag?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export const userBooksApi = {
  getStats: () =>
    api.get<UserBookStats>("/v1/user-books/stats"),

  list: (filters: UserBooksFilter = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.exclude_wishlist) params.set("exclude_wishlist", "true");
    if (filters.location_id) params.set("location_id", filters.location_id);
    if (filters.tag) params.set("tag", filters.tag);
    if (filters.search) params.set("search", filters.search);
    if (filters.limit) params.set("limit", String(filters.limit));
    if (filters.offset) params.set("offset", String(filters.offset));
    return api.get<UserBook[]>(`/v1/user-books/?${params}`);
  },

  getById: (id: string) =>
    api.get<UserBook>(`/v1/user-books/${id}`),

  create: (data: UserBookCreate) =>
    api.post<UserBook>("/v1/user-books/", data),

  update: (id: string, data: UserBookUpdate) =>
    api.patch<UserBook>(`/v1/user-books/${id}`, data),

  delete: (id: string) =>
    api.delete<void>(`/v1/user-books/${id}`),

  getUploadUrl: (
    userBookId: string,
    data: { file_type: "pdf" | "image"; original_filename: string; content_type: string }
  ) =>
    api.post<{ upload_url: string; file_key: string; expires_in: number }>(
      `/v1/user-books/${userBookId}/attachments/upload-url`,
      data
    ),

  listAttachments: (userBookId: string) =>
    api.get<Attachment[]>(`/v1/user-books/${userBookId}/attachments`),

  deleteAttachment: (userBookId: string, attachmentId: string) =>
    api.delete<void>(`/v1/user-books/${userBookId}/attachments/${attachmentId}`),
};
