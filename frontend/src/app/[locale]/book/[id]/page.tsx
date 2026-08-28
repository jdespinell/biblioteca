"use client";

import useSWR from "swr";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Star,
  MapPin,
  Tag,
  Loader2,
  Plus,
  Heart,
  Globe,
  Lock,
  Layers,
  Calendar,
} from "lucide-react";
import { booksApi } from "@/lib/api/books";
import { userBooksApi, type UserBook, type BookStatus } from "@/lib/api/user-books";
import { notesApi, socialApi, type BookNote, type PublicNote } from "@/lib/api/notes";
import { locationsApi, type Location } from "@/lib/api/locations";
import { useAuth } from "@/hooks/useAuth";
import dynamic from "next/dynamic";
import { useState } from "react";

const MarkdownEditor = dynamic(
  () => import("@/components/editor/MarkdownEditor"),
  { ssr: false }
);

function PublicNoteCard({ note }: { note: PublicNote }) {
  return (
    <div className="bg-white rounded-xl p-5 space-y-3 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-bold">
            {(note.author_display_name || "U")[0].toUpperCase()}
          </div>
          <p className="text-sm font-semibold text-gray-800">
            {note.author_display_name}
          </p>
        </div>
        <span className="text-xs text-gray-400">
          {new Date(note.updated_at).toLocaleDateString()}
        </span>
      </div>
      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
        {note.content}
      </p>
    </div>
  );
}

interface BookPageProps {
  params: { id: string; locale: string };
}

export default function BookPage({ params }: BookPageProps) {
  const { id, locale } = params;
  const t = useTranslations("books");
  const tn = useTranslations("notes");
  const td = useTranslations("discover");
  const { isAuthenticated } = useAuth();

  const [tagInput, setTagInput] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // 1. Global book details
  const { data: book, isLoading: bookLoading } = useSWR(
    ["book", id],
    () => booksApi.getById(id)
  );

  // 2. User books list to find this user's copy
  const { data: userBooks, mutate: mutateUserBooks } = useSWR(
    isAuthenticated ? ["user-books-all"] : null,
    () => userBooksApi.list({ limit: 100 })
  );

  const userBook: UserBook | undefined = userBooks?.find(
    (ub) => ub.global_book.id === id
  );

  // 3. User's personal note
  const { data: myNote, mutate: mutateNote } = useSWR<BookNote | null>(
    isAuthenticated && userBook ? ["my-note", id] : null,
    () => notesApi.getMyNote(id)
  );

  // 4. Public community notes
  const { data: publicNotes } = useSWR(
    ["public-notes", id],
    () => socialApi.getPublicNotes(id)
  );

  // 5. Locations for dropdown
  const { data: locations } = useSWR<Location[]>(
    isAuthenticated ? "locations" : null,
    locationsApi.list
  );

  const handleSaveNote = async (content: string, isPublic: boolean) => {
    const saved = await notesApi.upsertNote(id, { content, is_public: isPublic });
    await mutateNote(saved, false);
  };

  const handleStatusChange = async (newStatus: BookStatus) => {
    if (!userBook) return;
    await userBooksApi.update(userBook.id, { status: newStatus });
    await mutateUserBooks();
  };

  const handleRatingChange = async (newRating: number) => {
    if (!userBook) return;
    const finalRating = userBook.rating === newRating ? null : newRating;
    await userBooksApi.update(userBook.id, { rating: finalRating ?? undefined });
    await mutateUserBooks();
  };

  const handleLocationChange = async (locId: string) => {
    if (!userBook) return;
    await userBooksApi.update(userBook.id, { location_id: locId || null });
    await mutateUserBooks();
  };

  const handleAddTag = async () => {
    if (!userBook || !tagInput.trim()) return;
    const cleanTag = tagInput.trim().toLowerCase();
    if (!userBook.tags.includes(cleanTag)) {
      const newTags = [...userBook.tags, cleanTag];
      await userBooksApi.update(userBook.id, { tags: newTags });
      await mutateUserBooks();
    }
    setTagInput("");
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!userBook) return;
    const newTags = userBook.tags.filter((t) => t !== tagToRemove);
    await userBooksApi.update(userBook.id, { tags: newTags });
    await mutateUserBooks();
  };

  const handleAddBookToLibrary = async () => {
    if (!book) return;
    setIsUpdating(true);
    try {
      await userBooksApi.create({
        global_book_id: book.id,
        status: "unread",
      });
      await mutateUserBooks();
    } finally {
      setIsUpdating(false);
    }
  };

  if (bookLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 max-w-md mx-auto p-8 space-y-4">
        <BookOpen className="h-12 w-12 text-gray-300 mx-auto" />
        <h2 className="text-xl font-bold text-gray-900">Libro no encontrado</h2>
        <p className="text-sm text-gray-500">
          El libro solicitado no existe o fue eliminado del catálogo.
        </p>
        <Link
          href={`/${locale}/library`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white font-medium rounded-xl text-sm hover:bg-primary-700 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Mi Biblioteca
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Back button */}
      <div>
        <Link
          href={`/${locale}/library`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary-600 transition-colors font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Mi Biblioteca
        </Link>
      </div>

      {/* Book header card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 flex flex-col sm:flex-row gap-8">
        {/* Cover */}
        <div className="relative w-40 sm:w-48 aspect-[2/3] flex-shrink-0 rounded-2xl overflow-hidden bg-gray-100 shadow-md self-center sm:self-start">
          {book.cover_url ? (
            <Image
              src={book.cover_url}
              alt={book.title}
              fill
              className="object-cover"
              sizes="192px"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 text-primary-400 p-4 text-center">
              <BookOpen className="h-16 w-16 mb-2" />
              <span className="text-xs font-bold leading-tight">{book.title}</span>
            </div>
          )}
        </div>

        {/* Info & metadata */}
        <div className="flex-1 space-y-5 min-w-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
              {book.title}
            </h1>
            <p className="text-lg font-medium text-gray-600 mt-1">{book.author}</p>
            {book.publisher && (
              <p className="text-sm text-gray-400 mt-0.5">{book.publisher}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {book.published_year && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-100 text-gray-600">
                <Calendar className="h-3.5 w-3.5" />
                {book.published_year}
              </span>
            )}
            {book.page_count && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-100 text-gray-600">
                <Layers className="h-3.5 w-3.5" />
                {book.page_count} páginas
              </span>
            )}
            {book.language && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-100 text-gray-600">
                <Globe className="h-3.5 w-3.5" />
                {book.language.toUpperCase()}
              </span>
            )}
            {book.isbn && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-gray-100 font-mono text-gray-600">
                ISBN: {book.isbn}
              </span>
            )}
          </div>

          {book.description && (
            <p className="text-sm text-gray-600 leading-relaxed bg-gray-50/50 p-4 rounded-xl border border-gray-100">
              {book.description}
            </p>
          )}

          {/* User's copy management */}
          {userBook ? (
            <div className="pt-5 border-t border-gray-100 space-y-4">
              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Estado de Lectura
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(["unread", "reading", "read", "wishlist"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all text-center ${
                        userBook.status === s
                          ? "bg-primary-600 text-white border-primary-600 shadow-sm"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {t(`status.${s}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rating & Shelf Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Rating */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Calificación
                  </label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => handleRatingChange(star)}
                        className="p-1 hover:scale-125 transition-transform"
                      >
                        <Star
                          className={`h-6 w-6 ${
                            (userBook.rating ?? 0) >= star
                              ? "fill-amber-400 text-amber-400"
                              : "text-gray-200 hover:text-amber-200"
                          }`}
                        />
                      </button>
                    ))}
                    {userBook.rating && (
                      <span className="text-xs text-gray-500 ml-2 font-medium">
                        {userBook.rating}/5
                      </span>
                    )}
                  </div>
                </div>

                {/* Location */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Estantería / Ubicación Física
                  </label>
                  <select
                    value={userBook.location?.id ?? ""}
                    onChange={(e) => handleLocationChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    <option value="">Sin ubicación asignada</option>
                    {locations?.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Etiquetas
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Añadir etiqueta (ej: ficcion, favoritos)"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-xs font-medium transition"
                  >
                    <Plus className="h-3.5 w-3.5 inline mr-1" />
                    Añadir
                  </button>
                </div>
                {userBook.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {userBook.tags.map((tag) => (
                      <span
                        key={tag}
                        onClick={() => handleRemoveTag(tag)}
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-primary-50 text-primary-700 rounded-full text-xs font-medium cursor-pointer hover:bg-red-50 hover:text-red-600 transition"
                        title="Haz clic para eliminar"
                      >
                        #{tag} ×
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="pt-4 border-t border-gray-100">
              <button
                onClick={handleAddBookToLibrary}
                disabled={isUpdating}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition shadow-sm text-sm"
              >
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Añadir este libro a Mi Biblioteca
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Markdown Notes Editor */}
      {userBook && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Mis Notas y Resumen</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Tus notas admiten formato Markdown, fórmulas matemáticas KaTeX ($\LaTeX$) y guardado automático.
            </p>
          </div>
          <MarkdownEditor
            initialContent={myNote?.content ?? ""}
            initialIsPublic={myNote?.is_public ?? false}
            bookId={id}
            onSave={handleSaveNote}
          />
        </div>
      )}

      {/* Public Community Notes */}
      {publicNotes && publicNotes.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary-600" />
            <h2 className="text-xl font-bold text-gray-900">
              Notas de la Comunidad ({publicNotes.length})
            </h2>
          </div>
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
