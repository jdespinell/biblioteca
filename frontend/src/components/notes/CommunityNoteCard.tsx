"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";
import { BookOpen, Calendar, Globe, ChevronDown, ChevronUp, MessageSquare, ArrowRight } from "lucide-react";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

const MDPreview = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => mod.default.Markdown),
  {
    ssr: false,
    loading: () => <div className="h-12 bg-gray-50 rounded animate-pulse" />,
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
  const initialLetter = (note.author_display_name || "Lector")[0].toUpperCase();

  const isLong = note.content.length > 220;
  const [isExpanded, setIsExpanded] = useState(!isLong && !showBookInfo);

  // Clean plain-text preview when collapsed
  const previewText = isLong
    ? note.content.replace(/[#*`_~[\]]/g, "").slice(0, 200).trim() + "..."
    : note.content;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-5 space-y-3.5">
      {/* Header: Author Info & Book Badge */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary-600 to-indigo-500 text-white flex items-center justify-center font-bold text-xs shadow-sm flex-shrink-0">
            {initialLetter}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-gray-900 text-xs sm:text-sm">
                {note.author_display_name || "Lector anónimo"}
              </span>
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary-50 text-primary-700">
                <Globe className="h-2.5 w-2.5" />
                Lector
              </span>
            </div>
            <p className="text-[11px] text-gray-400 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(note.updated_at).toLocaleDateString(locale, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        {/* Book Mini Badge in Discover */}
        {showBookInfo && bookId && (
          <Link
            href={`/${locale}/book/${bookId}`}
            className="flex items-center gap-2 px-2.5 py-1.5 bg-gray-50 hover:bg-primary-50 rounded-xl border border-gray-100 transition group flex-shrink-0 max-w-[220px]"
          >
            <div className="relative w-6 h-8 bg-gray-200 rounded overflow-hidden flex-shrink-0 shadow-xs">
              {note.book_cover_url ? (
                <Image
                  src={note.book_cover_url}
                  alt={note.book_title ?? ""}
                  fill
                  className="object-cover"
                  sizes="24px"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-primary-100">
                  <BookOpen className="h-3 w-3 text-primary-600" />
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

      {/* Comment Content */}
      <div className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-100 text-sm text-gray-700 leading-relaxed">
        {isExpanded ? (
          <div
            data-color-mode="light"
            className="prose prose-sm prose-slate max-w-none text-gray-800 overflow-x-auto"
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
        ) : (
          <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
            {previewText}
          </p>
        )}
      </div>

      {/* Footer Actions: Ver más toggle + Ver libro */}
      <div className="flex items-center justify-between text-xs pt-0.5">
        {isLong ? (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-primary-600 hover:text-primary-700 font-semibold inline-flex items-center gap-1 hover:underline"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Ver menos
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Ver más...
              </>
            )}
          </button>
        ) : <div />}

        {showBookInfo && bookId && (
          <Link
            href={`/${locale}/book/${bookId}`}
            className="text-gray-500 hover:text-primary-600 font-medium inline-flex items-center gap-1 transition"
          >
            Ver libro completo
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}
