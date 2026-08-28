import { apiClient } from "./client";

export interface CoverRecognitionResult {
  title: string | null;
  author: string | null;
  publisher: string | null;
  isbn: string | null;
  confidence: number;
}

export interface BookSummaryResult {
  summary: string;
}

export const aiApi = {
  recognizeCover: (imageBase64: string, mimeType: string = "image/jpeg") =>
    apiClient.post<CoverRecognitionResult>("/ai/recognize-cover", {
      image_base64: imageBase64,
      mime_type: mimeType,
    }),

  summarizeBook: (title: string, author: string) =>
    apiClient.post<BookSummaryResult>("/ai/summarize", {
      title,
      author,
    }),
};
