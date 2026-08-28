"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";
import { BookOpen, User, Calendar, Globe, Sparkles } from "lucide-react";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

const MDPreview = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => mod.default.Markdown),
  {
    ssr: false,
    loading: () => <div className="h-16 bg-gray-50 rounded animate-pulse" />,
  }
);

// Extend sanitize schema to allow KaTeX classes
const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      ["className", /^katex/],
    ],
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      ["className", /^katex/],
    ],
  },
};

interface CommunityNoteCardProps {
  note: {
    id?: string;
    note_id?: string;
    book_id?: string;
    book_title?: string;
    book_author?: string;
    book_cover_url?: string | null;
    content: string;
    author_display_name: string;
    updated_at: string;
  };
  showBookInfo?: boolean;
}

export default function CommunityNoteCard({
  note,
  showBookInfo = false,
}: CommunityNoteCardProps) {
  const locale = useLocale();
  const bookId = note.book_id;
  const initialLetter = (note.author_display_name || "Lector")[0].toUpperCase();

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-6 space-y-4">
      {/* Header: Author info & Book mini-badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-600 to-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow-sm flex-shrink-0">
            {initialLetter}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 text-sm">
                {note.author_display_name || "Lector anónimo"}
              </span>
              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary-50 text-primary-700">
                <Globe className="h-2.5 w-2.5" />
                Comunidad
              </span>
            </div>
            <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
              <Calendar className="h-3 w-3" />
              {new Date(note.updated_at).toLocaleDateString(locale, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        {showBookInfo && bookId && (
          <Link
            href={`/${locale}/book/${bookId}`}
            className="flex items-center gap-2.5 p-1.5 pr-3 bg-gray-50 hover:bg-primary-50 rounded-xl border border-gray-100 transition group flex-shrink-0 max-w-[200px]"
          >
            <div className="relative w-7 h-10 bg-gray-200 rounded overflow-hidden flex-shrink-0">
              {note.book_cover_url ? (
                <Image
                  src={note.book_cover_url}
                  alt={note.book_title ?? ""}
                  fill
                  className="object-cover"
                  sizes="28px"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-primary-100">
                  <BookOpen className="h-3.5 w-3.5 text-primary-600" />
                </div>
              )}
            </div>
            <div className="min-w-0 text-left">
              <p className="text-xs font-semibold text-gray-800 group-hover:text-primary-700 truncate leading-tight">
                {note.book_title}
              </p>
              <p className="text-[10px] text-gray-400 truncate">
                {note.book_author}
              </p>
            </div>
          </Link>
        )}
      </div>

      {/* Rendered Markdown Note Content */}
      <div
        data-color-mode="light"
        className="prose prose-sm prose-slate max-w-none text-gray-800 bg-gray-50/50 p-4 rounded-xl border border-gray-100/80 leading-relaxed overflow-x-auto"
      >
        <MDPreview
          source={note.content}
          remarkPlugins={[remarkMath]}
          rehypePlugins={[
            [rehypeSanitize, sanitizeSchema],
            rehypeKatex,
          ]}
        />
      </div>

      {/* Footer link to full book */}
      {showBookInfo && bookId && (
        <div className="pt-1 flex justify-end">
          <Link
            href={`/${locale}/book/${bookId}`}
            className="text-xs font-semibold text-primary-600 hover:text-primary-700 inline-flex items-center gap-1 hover:underline"
          >
            Ver detalles del libro y más notas →
          </Link>
        </div>
      )}
    </div>
  );
}
