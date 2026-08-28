"use client";

import { useState } from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";
import { Compass, BookOpen, ChevronDown, Loader2 } from "lucide-react";
import { socialApi, type DiscoverNote } from "@/lib/api/notes";

const LANGUAGE_OPTIONS = [
  { value: "", label: "Todos los idiomas" },
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "pt", label: "Português" },
];

function NoteCard({ note }: { note: DiscoverNote }) {
  const locale = useLocale();
  const td = useTranslations("discover");

  return (
    <article className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      <div className="flex gap-4 p-5">
        {/* Book cover */}
        <Link href={`/${locale}/book/${note.book_id}`} className="flex-shrink-0">
          <div className="relative w-14 h-20 bg-gray-100 rounded-lg overflow-hidden">
            {note.book_cover_url ? (
              <Image
                src={note.book_cover_url}
                alt={note.book_title}
                fill
                className="object-cover"
                sizes="56px"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-primary-50">
                <BookOpen className="h-6 w-6 text-primary-300" />
              </div>
            )}
          </div>
        </Link>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-2">
          <div>
            <Link
              href={`/${locale}/book/${note.book_id}`}
              className="font-semibold text-gray-900 hover:text-primary-600 transition-colors text-sm line-clamp-1"
            >
              {note.book_title}
            </Link>
            <p className="text-xs text-gray-400">{note.book_author}</p>
          </div>

          <p className="text-sm text-gray-700 line-clamp-4 leading-relaxed">
            {note.content.substring(0, 400)}
          </p>

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {td("by")} <span className="font-medium text-gray-600">{note.author_display_name}</span>
            </span>
            <span className="text-xs text-gray-400">
              {new Date(note.updated_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function DiscoverPage() {
  const t = useTranslations("discover");
  const [language, setLanguage] = useState("");
  const [page, setPage] = useState(0);
  const LIMIT = 20;

  const { data: notes, isLoading } = useSWR(
    ["discover", language, page],
    () => socialApi.getDiscoverFeed(language || undefined, LIMIT, page * LIMIT)
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 rounded-xl mb-2">
          <Compass className="h-6 w-6 text-primary-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900">{t("title")}</h1>
        <p className="text-gray-500">{t("subtitle")}</p>
      </div>

      {/* Language filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {LANGUAGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => { setLanguage(opt.value); setPage(0); }}
            className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors border ${
              language === opt.value
                ? "bg-primary-600 text-white border-primary-600"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Notes feed */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary-400" />
        </div>
      ) : notes?.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <Compass className="h-12 w-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500">{t("noNotes")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notes?.map((note) => (
            <NoteCard key={note.note_id} note={note} />
          ))}

          {/* Pagination */}
          <div className="flex justify-center gap-3 pt-4">
            {page > 0 && (
              <button
                onClick={() => setPage(page - 1)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
              >
                ← Anterior
              </button>
            )}
            {notes && notes.length === LIMIT && (
              <button
                onClick={() => setPage(page + 1)}
                className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
              >
                {t("loadMore")}
                <ChevronDown className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
