"use client";

import { useState } from "react";
import useSWR from "swr";
import { useTranslations } from "next-intl";
import { Compass, ChevronDown, Loader2 } from "lucide-react";
import { socialApi, type DiscoverNote } from "@/lib/api/notes";
import CommunityNoteCard from "@/components/notes/CommunityNoteCard";

const LANGUAGE_OPTIONS = [
  { value: "", label: "Todos los idiomas" },
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "pt", label: "Português" },
];

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
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-100 rounded-2xl mb-2 shadow-sm text-primary-600">
          <Compass className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900">{t("title")}</h1>
        <p className="text-sm text-gray-500 max-w-lg mx-auto">{t("subtitle")}</p>
      </div>

      {/* Language filter */}
      <div className="flex items-center justify-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {LANGUAGE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => { setLanguage(opt.value); setPage(0); }}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              language === opt.value
                ? "bg-primary-600 text-white border-primary-600 shadow-sm"
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
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      ) : notes?.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 p-8 space-y-3">
          <Compass className="h-12 w-12 text-gray-300 mx-auto" />
          <p className="text-gray-600 font-medium">{t("noNotes")}</p>
          <p className="text-xs text-gray-400">Sé el primero en publicar una nota pública de tu libro favorito.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {notes?.map((note) => (
            <CommunityNoteCard
              key={note.note_id}
              note={note}
              showBookInfo={true}
            />
          ))}

          {/* Pagination */}
          <div className="flex justify-center gap-3 pt-4">
            {page > 0 && (
              <button
                onClick={() => setPage(page - 1)}
                className="px-4 py-2 text-xs font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition"
              >
                ← Anterior
              </button>
            )}
            {notes && notes.length === LIMIT && (
              <button
                onClick={() => setPage(page + 1)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition"
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
