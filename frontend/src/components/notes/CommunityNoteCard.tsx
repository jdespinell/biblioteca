"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";
import {
  BookOpen,
  Calendar,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  MessageSquareQuote,
  Sparkles,
} from "lucide-react";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

const MDPreview = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => mod.default.Markdown),
  {
    ssr: false,
    loading: () => <div className="h-12 bg-gray-50 rounded-lg animate-pulse" />,
  }
);

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
  const initialLetter = (note.author_display_name || "L")[0].toUpperCase();

  const isLong = note.content.length > 200;
  const [isExpanded, setIsExpanded] = useState(!isLong && !showBookInfo);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-5 space-y-4">
      {/* ── 1. HERO: The Book (Primary Element) ── */}
      {showBookInfo && bookId ? (
        <div className="flex items-start gap-4 pb-3.5 border-b border-gray-100">
          <Link
            href={`/${locale}/book/${bookId}`}
            className="relative w-16 h-24 bg-gray-100 rounded-xl overflow-hidden shadow-sm flex-shrink-0 hover:opacity-90 transition group"
          >
            {note.book_cover_url ? (
              <Image
                src={note.book_cover_url}
                alt={note.book_title ?? ""}
                fill
                unoptimized={note.book_cover_url.startsWith("data:")}
                className="object-cover group-hover:scale-105 transition-transform duration-300"
                sizes="64px"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-primary-50">
                <BookOpen className="h-7 w-7 text-primary-400" />
              </div>
            )}
          </Link>

          <div className="flex-1 min-w-0 space-y-1">
            <Link
              href={`/${locale}/book/${bookId}`}
              className="font-bold text-gray-900 hover:text-primary-600 text-base leading-snug transition-colors line-clamp-2 block"
            >
              {note.book_title || "Libro sin título"}
            </Link>

            <p className="text-xs text-gray-500 font-medium truncate">
              {note.book_author || "Autor desconocido"}
            </p>

            <div className="pt-1.5">
              <Link
                href={`/${locale}/book/${bookId}`}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 bg-primary-50 px-2.5 py-1 rounded-lg hover:bg-primary-100 transition"
              >
                Ver ficha del libro
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── 2. COMPLEMENT: Community Note / Review ── */}
      <div className="space-y-2.5">
        {/* Author header */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-primary-600 to-indigo-500 text-white flex items-center justify-center font-bold text-xs shadow-xs flex-shrink-0">
              {initialLetter}
            </div>
            <div>
              <span className="font-semibold text-gray-800">
                {note.author_display_name || "Lector anónimo"}
              </span>
              <span className="text-[11px] text-gray-400 ml-1.5">
                compartió una nota pública
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-gray-400">
            <Calendar className="h-3 w-3" />
            {new Date(note.updated_at).toLocaleDateString(locale, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </div>
        </div>

        {/* Note Content Box */}
        <div className="bg-gray-50/80 p-3.5 rounded-xl border border-gray-100 text-sm text-gray-800 leading-relaxed relative">
          <div className="flex items-start gap-2">
            <MessageSquareQuote className="h-4 w-4 text-primary-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div
                data-color-mode="light"
                className={`prose prose-sm prose-slate max-w-none text-gray-800 overflow-hidden transition-all duration-300 ${
                  !isExpanded ? "max-h-20" : "max-h-none"
                }`}
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

              {/* Gradient fade when collapsed */}
              {isLong && !isExpanded && (
                <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-gray-50 via-gray-50/90 to-transparent pointer-events-none rounded-b-xl" />
              )}
            </div>
          </div>
        </div>

        {/* Ver más / Ver menos Toggle */}
        {isLong && (
          <div className="flex justify-end pt-0.5">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 inline-flex items-center gap-1 hover:underline transition"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  Ver menos
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  Ver más de esta nota...
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
