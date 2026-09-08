import { api } from "./client";

export interface BookNote {
  id: string;
  user_id: string;
  global_book_id: string;
  parent_id?: string | null;
  content: string;
  is_public: boolean;
  author_display_name?: string;
  created_at: string;
  updated_at: string;
}

export interface PublicNote {
  id: string;
  global_book_id: string;
  parent_id?: string | null;
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

export interface CreateNoteData {
  content: string;
  is_public: boolean;
  parent_id?: string | null;
}

export interface UpdateNoteData {
  content?: string;
  is_public?: boolean;
}

export const notesApi = {
  getMyNotes: (bookId: string) =>
    api.get<BookNote[]>(`/v1/notes/book/${bookId}`),

  createNote: (bookId: string, data: CreateNoteData) =>
    api.post<BookNote>(`/v1/notes/book/${bookId}`, data),

  updateNote: (noteId: string, data: UpdateNoteData) =>
    api.patch<BookNote>(`/v1/notes/${noteId}`, data),

  deleteNote: (noteId: string) =>
    api.delete<void>(`/v1/notes/${noteId}`),
};

export const socialApi = {
  getPublicNotes: (bookId: string, limit = 50, offset = 0) =>
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
