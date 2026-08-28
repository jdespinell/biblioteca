"use client";

import { use } from "react";
import useSWR from "swr";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BookOpen, Star, MapPin, Tag, Loader2 } from "lucide-react";
import { booksApi } from "@/lib/api/books";
import { userBooksApi, type UserBook } from "@/lib/api/user-books";
import { notesApi, socialApi, type BookNote, type PublicNote } from "@/lib/api/notes";
import dynamic from "next/dynamic";
import { useState } from "react";

const MarkdownEditor = dynamic(
  () => import("@/components/editor/MarkdownEditor"),
  { ssr: false }
);

// Render public notes safely (server-safe markdown preview)
function PublicNoteCard({ note }: { note: PublicNote }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 space-y-2 border border-gray-100">
      <p className="text-xs font-medium text-primary-600">
        {note.author_display_name}
      </p>
      {/* Render first 300 chars as plain text for safety */}
      <p className="text-sm text-gray-700 line-clamp-4 whitespace-pre-wrap">
        {note.content.substring(0, 300)}
        {note.content.length > 300 && "..."}
      </p>
      <p className="text-xs text-gray-400">
        {new Date(note.updated_at).toLocaleDateString()}
      </p>
    </div>
  );
}

interface BookPageProps {
  params: Promise<{ id: string; locale: string }>;
}

export default function BookPage({ params }: BookPageProps) {
  const { id, locale } = use(params);
  const t = useTranslations("books");
  const tn = useTranslations("notes");
  const td = useTranslations("discover");

  const { data: book, isLoading: bookLoading } = useSWR(
    ["book", id],
    () => booksApi.getById(id)
  );

  // This tries to find the user's copy of this book
  const { data: userBooks } = useSWR(
    ["user-books-for-book", id],
    () => userBooksApi.list({ limit: 1 })
  );

  const userBook: UserBook | undefined = userBooks?.find(
    (ub) => ub.global_book.id === id
  );

  const { data: myNote, mutate: mutateNote } = useSWR<BookNote | null>(
    ["my-note", id],
    () => notesApi.getMyNote(id)
  );

  const { data: publicNotes } = useSWR(
    ["public-notes", id],
    () => socialApi.getPublicNotes(id)
  );

  const [rating, setRating] = useState(userBook?.rating ?? 0);

  const handleSaveNote = async (content: string, isPublic: boolean) => {
    const saved = await notesApi.upsertNote(id, { content, is_public: isPublic });
    await mutateNote(saved, false);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!userBook) return;
    await userBooksApi.update(userBook.id, { status: newStatus as any });
  };

  const handleRatingChange = async (newRating: number) => {
    if (!userBook) return;
    setRating(newRating);
    await userBooksApi.update(userBook.id, { rating: newRating });
  };

  if (bookLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Libro no encontrado</p>
        <Link href={`/${locale}/library`} className="text-primary-600 hover:underline mt-2 inline-block">
          Volver a la biblioteca
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Back button */}
      <Link
        href={`/${locale}/library`}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary-600 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a la biblioteca
      </Link>

      {/* Book header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col sm:flex-row gap-6">
        {/* Cover */}
        <div className="relative w-36 h-52 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100 self-start mx-auto sm:mx-0">
          {book.cover_url ? (
            <Image
              src={book.cover_url}
              alt={book.title}
              fill
              className="object-cover"
              sizes="144px"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary-100 to-primary-200">
              <BookOpen className="h-16 w-16 text-primary-400" />
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="flex-1 space-y-4 min-w-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">{book.title}</h1>
            <p className="text-lg text-gray-600 mt-1">{book.author}</p>
            {book.publisher && (
              <p className="text-sm text-gray-400 mt-0.5">{book.publisher}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
            {book.published_year && <span>{t("publishedYear")}: {book.published_year}</span>}
            {book.page_count && <span>{book.page_count} {t("pages")}</span>}
            {book.language && <span>{t("language")}: {book.language.toUpperCase()}</span>}
            {book.isbn && <span className="font-mono">ISBN: {book.isbn}</span>}
          </div>

          {book.description && (
            <p className="text-sm text-gray-600 line-clamp-3">{book.description}</p>
          )}

          {/* User's copy section */}
          {userBook && (
            <div className="pt-4 border-t border-gray-100 space-y-3">
              {/* Status selector */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-600">Estado:</span>
                {(["unread", "reading", "read", "wishlist"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      userBook.status === s
                        ? "bg-primary-600 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {t(`status.${s}`)}
                  </button>
                ))}
              </div>

              {/* Rating */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">{t("rating")}:</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => handleRatingChange(star)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={`h-5 w-5 ${
                          star <= rating
                            ? "fill-amber-400 text-amber-400"
                            : "text-gray-200 hover:text-amber-300"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Location */}
              {userBook.location && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <MapPin className="h-4 w-4" />
                  <span>{userBook.location.name}</span>
                </div>
              )}

              {/* Tags */}
              {userBook.tags.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag className="h-4 w-4 text-gray-400" />
                  {userBook.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Markdown Editor (my notes) */}
      {userBook && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <MarkdownEditor
            initialContent={myNote?.content ?? ""}
            initialIsPublic={myNote?.is_public ?? false}
            bookId={id}
            onSave={handleSaveNote}
          />
        </div>
      )}

      {/* Public notes section */}
      {publicNotes && publicNotes.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {td("recentNotes")} ({publicNotes.length})
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {publicNotes.map((note) => (
              <PublicNoteCard key={note.id} note={note} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
