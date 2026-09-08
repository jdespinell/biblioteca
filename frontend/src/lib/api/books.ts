import { api } from "./client";

export interface GlobalBook {
  id: string;
  isbn: string | null;
  isbn13: string | null;
  title: string;
  author: string;
  publisher: string | null;
  language: string;
  cover_url: string | null;
  description: string | null;
  published_year: number | null;
  page_count: number | null;
  source: string;
  created_at: string;
}

export interface GlobalBookCreate {
  isbn?: string;
  isbn13?: string;
  title: string;
  author: string;
  publisher?: string;
  language?: string;
  cover_url?: string;
  description?: string;
  published_year?: number;
  page_count?: number;
  source?: "manual" | "openlibrary" | "googlebooks" | "ai" | (string & {});
}

export interface ISBNLookupResult {
  id?: string | null;
  isbn: string | null;
  isbn13: string | null;
  title: string | null;
  author: string | null;
  publisher: string | null;
  language: string | null;
  cover_url: string | null;
  description: string | null;
  published_year: number | null;
  page_count: number | null;
  source: string;
  found: boolean;
}

export const booksApi = {
  search: (q?: string, limit = 20, offset = 0) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    return api.get<GlobalBook[]>(`/v1/books/?${params}`);
  },

  getById: (bookId: string) =>
    api.get<GlobalBook>(`/v1/books/${bookId}`),

  lookupISBN: (isbn: string) =>
    api.get<ISBNLookupResult>(`/v1/books/isbn/${isbn}`),

  create: (data: GlobalBookCreate) =>
    api.post<GlobalBook>("/v1/books/", data),

  update: (bookId: string, data: Partial<GlobalBookCreate>) =>
    api.patch<GlobalBook>(`/v1/books/${bookId}`, data),
};
