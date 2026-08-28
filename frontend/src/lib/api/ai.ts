import { api } from "./client";

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
    api.post<CoverRecognitionResult>("/v1/ai/recognize-cover", {
      image_base64: imageBase64,
      mime_type: mimeType,
    }),

  summarizeBook: (title: string, author: string) =>
    api.post<BookSummaryResult>("/v1/ai/summarize", {
      title,
      author,
    }),
};
