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
  Sparkles,
  Edit3,
  Check,
  X,
  FileText,
  Camera,
} from "lucide-react";
import { booksApi } from "@/lib/api/books";
import { aiApi } from "@/lib/api/ai";
import { userBooksApi, type UserBook, type BookStatus } from "@/lib/api/user-books";
import { notesApi, socialApi, type BookNote, type PublicNote } from "@/lib/api/notes";
import { locationsApi, type Location } from "@/lib/api/locations";
import { useAuth } from "@/hooks/useAuth";
import { useState, useRef } from "react";
import BookSummaryViewer from "@/components/book/BookSummaryViewer";
import BookCommentsSection from "@/components/book/BookCommentsSection";

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
  const [isSummarizing, setIsSummarizing] = useState(false);

  // Synopsis / Summary editing state (Personal to the user's UserBook)
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [isSavingSummary, setIsSavingSummary] = useState(false);

  // Cover upload state
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [isUpdatingCover, setIsUpdatingCover] = useState(false);

  // 1. Global book details
  const { data: book, isLoading: bookLoading, mutate: mutateBook } = useSWR(
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

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !book) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (!base64) return;

      const img = new window.Image();
      img.onload = async () => {
        const maxDim = 1200;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL("image/jpeg", 0.85);
          setIsUpdatingCover(true);
          try {
            await booksApi.update(book.id, { cover_url: compressed });
            await mutateBook();
            await mutateUserBooks();
          } catch (err) {
            console.error("Error updating cover:", err);
          } finally {
            setIsUpdatingCover(false);
          }
        }
      };
      img.src = base64;
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = "";
  };

  const handleStartEditSummary = () => {
    setSummaryText(userBook?.summary ?? "");
    setIsEditingSummary(true);
  };

  const handleSaveSummary = async () => {
    if (!userBook) return;
    setIsSavingSummary(true);
    try {
      await userBooksApi.update(userBook.id, { summary: summaryText.trim() });
      await mutateUserBooks();
      setIsEditingSummary(false);
    } catch (e) {
      console.error("Error saving personal summary:", e);
    } finally {
      setIsSavingSummary(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!book) return;
    setIsSummarizing(true);
    try {
      const res = await aiApi.summarizeBook(book.title, book.author);
      if (res?.summary) {
        setSummaryText(res.summary);
        if (!isEditingSummary) {
          setIsEditingSummary(true);
        }
      }
    } catch (e) {
      console.error("AI summary error:", e);
    } finally {
      setIsSummarizing(false);
    }
  };

  // 3. User's personal notes & comments
  const { data: myNotes, mutate: mutateMyNotes } = useSWR<BookNote[]>(
    isAuthenticated ? ["my-notes", id] : null,
    () => notesApi.getMyNotes(id)
  );

  // 4. Public community notes
  const { data: publicNotes, mutate: mutatePublicNotes } = useSWR(
    ["public-notes", id],
    () => socialApi.getPublicNotes(id)
  );

  // 5. Locations for dropdown
  const { data: locations } = useSWR<Location[]>(
    isAuthenticated ? "locations" : null,
    locationsApi.list
  );

  const handleStatusChange = async (newStatus: BookStatus) => {
    if (!userBook) return;
    await userBooksApi.update(userBook.id, { status: newStatus });
    await mutateUserBooks();
  };

  const handleLocationChange = async (locationId: string) => {
    if (!userBook) return;
    await userBooksApi.update(userBook.id, {
      location_id: locationId || null,
    });
    await mutateUserBooks();
  };

  const handleRatingChange = async (rating: number) => {
    if (!userBook) return;
    const newRating = userBook.rating === rating ? null : rating;
    await userBooksApi.update(userBook.id, { rating: newRating });
    await mutateUserBooks();
  };

  const handleAddTag = async () => {
    if (!userBook || !tagInput.trim()) return;
    const tag = tagInput.trim().toLowerCase();
    if (!userBook.tags.includes(tag)) {
      const updatedTags = [...userBook.tags, tag];
      await userBooksApi.update(userBook.id, { tags: updatedTags });
      await mutateUserBooks();
    }
    setTagInput("");
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    if (!userBook) return;
    const updatedTags = userBook.tags.filter((t) => t !== tagToRemove);
    await userBooksApi.update(userBook.id, { tags: updatedTags });
    await mutateUserBooks();
  };

  const handleAddBookToLibrary = async () => {
    if (!isAuthenticated) {
      window.location.href = `/${locale}/auth/login`;
      return;
    }
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
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 p-8">
        <p className="text-gray-500 mb-4">Libro no encontrado</p>
        <Link
          href={`/${locale}/library`}
          className="text-primary-600 font-medium hover:underline inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> Volver a la biblioteca
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Back button */}
      <div>
        <Link
          href={`/${locale}/library`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 bg-white border border-gray-200 px-3 py-1.5 rounded-xl transition shadow-xs"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a Mi Biblioteca
        </Link>
      </div>

      {/* Book header card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 flex flex-col sm:flex-row gap-8">
        {/* Cover */}
        <div className="relative w-40 sm:w-48 aspect-[2/3] flex-shrink-0 rounded-2xl overflow-hidden bg-gray-100 shadow-md self-center sm:self-start group border border-gray-200">
          {book.cover_url ? (
            <>
              <Image
                src={book.cover_url}
                alt={book.title}
                fill
                unoptimized={book.cover_url.startsWith("data:")}
                className="object-cover"
                sizes="192px"
              />
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={isUpdatingCover}
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity p-2 text-center backdrop-blur-xs cursor-pointer"
                title="Cambiar foto de portada"
              >
                {isUpdatingCover ? (
                  <Loader2 className="h-6 w-6 animate-spin text-white mb-1" />
                ) : (
                  <Camera className="h-6 w-6 mb-1" />
                )}
                <span className="text-xs font-bold">Cambiar portada</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={isUpdatingCover}
              className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 text-primary-600 hover:bg-primary-100/90 p-4 text-center transition-colors cursor-pointer border-2 border-dashed border-primary-200"
            >
              {isUpdatingCover ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary-600 mb-2" />
              ) : (
                <Camera className="h-8 w-8 text-primary-500 mb-2 animate-pulse" />
              )}
              <span className="text-xs font-bold leading-tight">Tomar o subir foto de portada</span>
            </button>
          )}
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleCoverUpload}
          />
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
            {(book.isbn || book.isbn13) && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-100 text-gray-800 font-mono text-xs border border-gray-200">
                <span className="font-bold text-gray-500">ISBN:</span>
                <span className="font-semibold">{book.isbn13 || book.isbn}</span>
              </span>
            )}
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
          </div>

          {/* Cover photo action button */}
          <div>
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              disabled={isUpdatingCover}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors border border-blue-200 shadow-xs cursor-pointer"
            >
              {isUpdatingCover ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
              {book.cover_url ? "Cambiar foto de portada" : "Tomar o agregar foto de portada"}
            </button>
          </div>

          {/* User's copy management */}
          {userBook ? (
            <div className="pt-5 border-t border-gray-100 space-y-5">
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

              {/* Rating & Shelf Location (Only for acquired books, not for wishlist) */}
              {userBook.status === "wishlist" ? (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-800">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">🎁</span>
                    <div>
                      <p className="font-semibold text-amber-900">Libro en tu Lista de Deseos (Wishlist)</p>
                      <p className="text-amber-700 mt-0.5">
                        Aún no tienes este libro físicamente. No requiere estantería.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleStatusChange("unread")}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg transition shadow-sm whitespace-nowrap text-xs"
                  >
                    ✓ Marcar como adquirido
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
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
              )}

              {/* ── Personal Private Summary / Synopsis Section ── */}
              <div className="space-y-3 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-gray-400" />
                    <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Mi Sinopsis / Resumen Personal (Privado)
                    </label>
                  </div>

                  {!isEditingSummary && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleStartEditSummary}
                        className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-primary-600 px-2.5 py-1 rounded-lg hover:bg-gray-100 transition"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Editar mi resumen
                      </button>
                      <button
                        type="button"
                        onClick={handleGenerateSummary}
                        disabled={isSummarizing}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 px-2.5 py-1 rounded-lg bg-primary-50 hover:bg-primary-100 transition disabled:opacity-50"
                      >
                        {isSummarizing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5 text-primary-600" />
                        )}
                        {userBook.summary ? "Regenerar con IA" : "Generar con IA"}
                      </button>
                    </div>
                  )}
                </div>

                {isEditingSummary ? (
                  <div className="space-y-3 bg-gray-50/80 p-4 rounded-xl border border-primary-200 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">
                        Escribe o edita tu sinopsis personal:
                      </span>
                      <button
                        type="button"
                        onClick={handleGenerateSummary}
                        disabled={isSummarizing}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 bg-white border border-primary-200 px-2.5 py-1 rounded-lg hover:bg-primary-50 transition shadow-xs disabled:opacity-50"
                      >
                        {isSummarizing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5 text-primary-600" />
                        )}
                        Rellenar con IA
                      </button>
                    </div>

                    <textarea
                      rows={5}
                      value={summaryText}
                      onChange={(e) => setSummaryText(e.target.value)}
                      placeholder="Escribe tu resumen personal, temas clave o apuntes de este libro..."
                      className="w-full p-3 border border-gray-300 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white leading-relaxed resize-y"
                      autoFocus
                    />

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingSummary(false);
                          setSummaryText("");
                        }}
                        disabled={isSavingSummary}
                        className="px-3.5 py-1.5 border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-100 transition"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveSummary}
                        disabled={isSavingSummary}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary-600 text-white text-xs font-semibold rounded-lg hover:bg-primary-700 transition shadow-sm disabled:opacity-50"
                      >
                        {isSavingSummary ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Guardar mi resumen
                      </button>
                    </div>
                  </div>
                ) : userBook.summary ? (
                  <BookSummaryViewer content={userBook.summary} />
                ) : (
                  <div className="text-xs text-gray-400 italic bg-gray-50/50 p-4 rounded-xl border border-dashed border-gray-200 flex items-center justify-between">
                    <span>Aún no tienes un resumen para este libro. Puedes escribirlo o generarlo con IA.</span>
                    <button
                      type="button"
                      onClick={handleStartEditSummary}
                      className="text-primary-600 hover:underline font-medium ml-2 flex-shrink-0"
                    >
                      + Crear resumen
                    </button>
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="pt-2 border-t border-gray-100">
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

      {/* Social Comments & Community Notes Thread */}
      <BookCommentsSection
        bookId={id}
        bookTitle={book.title}
        myNotes={myNotes ?? []}
        publicNotes={publicNotes ?? []}
        userRating={userBook?.rating}
        onMutateMyNotes={mutateMyNotes}
        onMutatePublicNotes={mutatePublicNotes}
      />
    </div>
  );
}
