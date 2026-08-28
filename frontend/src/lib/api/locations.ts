import { api } from "./client";

export interface Location {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  book_count: number;
}

export const locationsApi = {
  list: () =>
    api.get<Location[]>("/v1/locations/"),

  create: (data: { name: string; description?: string }) =>
    api.post<Location>("/v1/locations/", data),

  update: (id: string, data: { name?: string; description?: string }) =>
    api.put<Location>(`/v1/locations/${id}`, data),

  delete: (id: string) =>
    api.delete<void>(`/v1/locations/${id}`),
};

export const aiApi = {
  recognizeCover: (imageBase64: string, mimeType = "image/jpeg") =>
    api.post<{
      title: string | null;
      author: string | null;
      publisher: string | null;
      isbn: string | null;
      confidence: number;
    }>("/v1/ai/recognize-cover", {
      image_base64: imageBase64,
      mime_type: mimeType,
    }),

  scanISBN: (isbn: string) =>
    api.post<{
      isbn: string | null;
      title: string | null;
      author: string | null;
      found: boolean;
    }>(`/v1/ai/isbn-scan?isbn=${encodeURIComponent(isbn)}`),
};
