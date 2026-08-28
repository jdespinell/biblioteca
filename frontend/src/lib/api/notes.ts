import { api } from "./client";

export interface BookNote {
  id: string;
  user_id: string;
  global_book_id: string;
  content: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface PublicNote {
  id: string;
  global_book_id: string;
  content: string;
  author_display_name: string;
  created_at: string;
  updated_at: string;
}

export interface DiscoverNote {
  note_id: string;
  content: string;
  author_display_name: string;
  updated_at: string;
  book_id: string;
  book_title: string;
  book_author: string;
  book_cover_url: string | null;
}

export const notesApi = {
  getMyNote: (bookId: string) =>
    api.get<BookNote | null>(`/v1/notes/book/${bookId}`),

  upsertNote: (bookId: string, data: { content: string; is_public: boolean }) =>
    api.put<BookNote>(`/v1/notes/book/${bookId}`, data),

  updateNote: (bookId: string, data: { content?: string; is_public?: boolean }) =>
    api.patch<BookNote>(`/v1/notes/book/${bookId}`, data),

  deleteNote: (bookId: string) =>
    api.delete<void>(`/v1/notes/book/${bookId}`),
};

export const socialApi = {
  getPublicNotes: (bookId: string, limit = 20, offset = 0) =>
    api.get<PublicNote[]>(
      `/v1/social/notes/${bookId}?limit=${limit}&offset=${offset}`
    ),

  getDiscoverFeed: (language?: string, limit = 20, offset = 0) => {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    if (language) params.set("language", language);
    return api.get<DiscoverNote[]>(`/v1/social/discover?${params}`);
  },
};
