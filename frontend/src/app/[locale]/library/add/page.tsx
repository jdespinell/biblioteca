"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Search, QrCode, Camera, ArrowLeft, Plus, Loader2, Edit3, BookOpen } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { booksApi, type GlobalBook, type ISBNLookupResult, type GlobalBookCreate } from "@/lib/api/books";
import { userBooksApi } from "@/lib/api/user-books";
import { locationsApi, type Location } from "@/lib/api/locations";
import useSWR from "swr";

const BarcodeScanner = dynamic(
  () => import("@/components/scanner/BarcodeScanner"),
  { ssr: false }
);
const CoverCapture = dynamic(
  () => import("@/components/scanner/CoverCapture"),
  { ssr: false }
);

type Step = "search" | "manual" | "confirm" | "done";

export default function AddBookPage() {
  const t = useTranslations("books");
  const locale = useLocale();
  const router = useRouter();

  const [step, setStep] = useState<Step>("search");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GlobalBook[]>([]);
  const [selectedBook, setSelectedBook] = useState<GlobalBook | ISBNLookupResult | GlobalBookCreate | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<"unread" | "reading" | "read" | "wishlist">("unread");
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Manual book form state
  const [manualTitle, setManualTitle] = useState("");
  const [manualAuthor, setManualAuthor] = useState("");
  const [manualPublisher, setManualPublisher] = useState("");
  const [manualIsbn, setManualIsbn] = useState("");
  const [manualYear, setManualYear] = useState("");
  const [manualPages, setManualPages] = useState("");
  const [manualLanguage, setManualLanguage] = useState("es");
  const [manualDescription, setManualDescription] = useState("");
  const [manualCoverUrl, setManualCoverUrl] = useState("");

  const { data: locations } = useSWR<Location[]>("locations", locationsApi.list);

  const handleSearch = async () => {
    const clean = query.trim();
    if (!clean) return;
    setIsSearching(true);
    setErrorMessage(null);
    try {
      // If query is an ISBN (10 or 13 digits), try direct ISBN lookup
      const cleanIsbn = clean.replace(/[-\s]/g, "");
      if (/^(97[89])?\d{9}[\dX]$/i.test(cleanIsbn)) {
        const result = await booksApi.lookupISBN(cleanIsbn);
        if (result.found) {
          setSelectedBook(result);
          setStep("confirm");
          return;
        }
      }
      const results = await booksApi.search(clean, 10);
      setSearchResults(results);
      if (results.length === 0) {
        setErrorMessage("No se encontraron libros con ese título o autor.");
      }
    } catch (e) {
      console.error("Search error:", e);
      setErrorMessage("Error al buscar. Verifica tu conexión.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleISBNScan = async (isbn: string) => {
    setShowScanner(false);
    setIsSearching(true);
    setErrorMessage(null);
    try {
      const result = await booksApi.lookupISBN(isbn);
      if (result.found) {
        setSelectedBook(result);
        setStep("confirm");
      } else {
        setErrorMessage(`No se encontró ningún libro para el ISBN: ${isbn}. Puedes crearlo manualmente.`);
      }
    } catch (e) {
      console.error("ISBN scan error:", e);
      setErrorMessage("Error al consultar el ISBN. Intenta de nuevo.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleCoverResult = (result: {
    title: string | null;
    author: string | null;
    publisher: string | null;
    isbn: string | null;
    confidence: number;
  }) => {
    setShowCapture(false);
    if (result.isbn) {
      handleISBNScan(result.isbn);
    } else if (result.title) {
      setQuery(result.title);
      handleSearch();
    }
  };

  const handleSelectBook = (book: GlobalBook) => {
    setSelectedBook(book);
    setStep("confirm");
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput("");
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim() || !manualAuthor.trim()) {
      setErrorMessage("El título y el autor son obligatorios.");
      return;
    }
    setErrorMessage(null);
    const bookData: GlobalBookCreate = {
      title: manualTitle.trim(),
      author: manualAuthor.trim(),
      publisher: manualPublisher.trim() || undefined,
      isbn: manualIsbn.trim() || undefined,
      published_year: manualYear ? parseInt(manualYear, 10) : undefined,
      page_count: manualPages ? parseInt(manualPages, 10) : undefined,
      language: manualLanguage,
      description: manualDescription.trim() || undefined,
      cover_url: manualCoverUrl.trim() || undefined,
      source: "manual",
    };
    setSelectedBook(bookData);
    setStep("confirm");
  };

  const handleConfirm = async () => {
    if (!selectedBook) return;
    setIsAdding(true);
    setErrorMessage(null);

    try {
      let bookId: string;

      if ("id" in selectedBook && selectedBook.id) {
        bookId = selectedBook.id;
      } else {
        const bookData = selectedBook as GlobalBookCreate;
        const created = await booksApi.create({
          isbn: bookData.isbn || undefined,
          isbn13: (selectedBook as ISBNLookupResult).isbn13 || undefined,
          title: bookData.title || "Título desconocido",
          author: bookData.author || "Autor desconocido",
          publisher: bookData.publisher || undefined,
          language: bookData.language || "es",
          cover_url: bookData.cover_url || undefined,
          description: bookData.description || undefined,
          published_year: bookData.published_year || undefined,
          page_count: bookData.page_count || undefined,
          source: bookData.source || "manual",
        });
        bookId = created.id;
      }

      await userBooksApi.create({
        global_book_id: bookId,
        status: selectedStatus,
        location_id: selectedLocationId || undefined,
        tags,
      });

      router.push(`/${locale}/library`);
    } catch (e: unknown) {
      console.error("Error adding book to library:", e);
      const detail = (e as { data?: { detail?: string }; message?: string })?.data?.detail 
        || (e as { message?: string })?.message 
        || "Error al agregar el libro a tu biblioteca";
      setErrorMessage(detail);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/${locale}/library`} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{t("addBook")}</h1>
      </div>

      {step === "search" && (
        <div className="space-y-6">
          {/* Search input */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-800">Buscar por título, autor o código ISBN</h2>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Ej: Cien años de soledad o 9780307474728"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </button>
            </div>

            {errorMessage && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-sm">
                {errorMessage}
              </div>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => setShowScanner(true)}
                className="flex items-center justify-center gap-2 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-primary-600 hover:border-primary-200 transition-colors"
              >
                <QrCode className="h-4 w-4" />
                {t("scanISBN")}
              </button>
              <button
                onClick={() => setShowCapture(true)}
                className="flex items-center justify-center gap-2 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-primary-600 hover:border-primary-200 transition-colors"
              >
                <Camera className="h-4 w-4" />
                {t("scanCover")}
              </button>
              <button
                onClick={() => {
                  setErrorMessage(null);
                  setStep("manual");
                }}
                className="flex items-center justify-center gap-2 px-3 py-2.5 border border-dashed border-primary-300 bg-primary-50/40 rounded-lg text-sm text-primary-700 hover:bg-primary-50 hover:border-primary-400 transition-colors font-medium"
              >
                <Edit3 className="h-4 w-4" />
                Ingreso manual
              </button>
            </div>
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">Resultados ({searchResults.length})</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {searchResults.map((book) => (
                  <button
                    key={book.id}
                    onClick={() => handleSelectBook(book)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="relative w-12 h-16 bg-gray-100 rounded flex-shrink-0 overflow-hidden">
                      {book.cover_url ? (
                        <Image src={book.cover_url} alt={book.title} fill className="object-cover" sizes="48px" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-primary-50">
                          <span className="text-primary-400 text-xs font-bold">
                            {book.title.charAt(0)}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">{book.title}</p>
                      <p className="text-sm text-gray-500 truncate">{book.author}</p>
                      {book.published_year && (
                        <p className="text-xs text-gray-400">{book.published_year}</p>
                      )}
                    </div>
                    <Plus className="h-4 w-4 text-primary-500 ml-auto flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual Book Entry Form */}
      {step === "manual" && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
          <div className="border-b border-gray-100 pb-3">
            <h2 className="text-lg font-bold text-gray-900">Ingresar libro manualmente</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Ideal para libros antiguos, de editoriales independientes o sin código ISBN.
            </p>
          </div>

          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Título del libro <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Cien años de soledad"
                value={manualTitle}
                onChange={(e) => setManualTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Autor <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ej: Gabriel García Márquez"
                value={manualAuthor}
                onChange={(e) => setManualAuthor(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Editorial</label>
                <input
                  type="text"
                  placeholder="Ej: Sudamericana"
                  value={manualPublisher}
                  onChange={(e) => setManualPublisher(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ISBN (opcional)</label>
                <input
                  type="text"
                  placeholder="Ej: 9780307474728"
                  value={manualIsbn}
                  onChange={(e) => setManualIsbn(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
                <input
                  type="number"
                  placeholder="Ej: 1967"
                  value={manualYear}
                  onChange={(e) => setManualYear(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Páginas</label>
                <input
                  type="number"
                  placeholder="Ej: 471"
                  value={manualPages}
                  onChange={(e) => setManualPages(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Idioma</label>
                <select
                  value={manualLanguage}
                  onChange={(e) => setManualLanguage(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="es">Español</option>
                  <option value="en">English</option>
                  <option value="pt">Português</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">URL de Portada (opcional)</label>
              <input
                type="url"
                placeholder="https://ejemplo.com/portada.jpg"
                value={manualCoverUrl}
                onChange={(e) => setManualCoverUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción / Sinopsis (opcional)</label>
              <textarea
                rows={3}
                placeholder="Breve resumen del libro..."
                value={manualDescription}
                onChange={(e) => setManualDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep("search")}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
              >
                Volver a búsqueda
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors text-sm"
              >
                Continuar a estante y estado →
              </button>
            </div>
          </form>
        </div>
      )}

      {step === "confirm" && selectedBook && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
              {errorMessage}
            </div>
          )}

          {/* Book preview */}
          <div className="flex gap-4">
            <div className="relative w-20 h-28 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
              {selectedBook.cover_url ? (
                <Image src={selectedBook.cover_url} alt={selectedBook.title ?? ""} fill className="object-cover" sizes="80px" />
              ) : (
                <div className="absolute inset-0 bg-primary-50 flex items-center justify-center">
                  <BookOpen className="h-8 w-8 text-primary-400" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-gray-900 leading-tight">
                {selectedBook.title ?? "Título desconocido"}
              </h2>
              <p className="text-gray-600 mt-1">{selectedBook.author}</p>
              {selectedBook.publisher && (
                <p className="text-sm text-gray-400 mt-0.5">{selectedBook.publisher}</p>
              )}
              {selectedBook.isbn && (
                <p className="text-xs font-mono text-gray-400 mt-1">ISBN: {selectedBook.isbn}</p>
              )}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Estado inicial</label>
            <div className="grid grid-cols-2 gap-2">
              {(["unread", "reading", "read", "wishlist"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedStatus(s)}
                  className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                    selectedStatus === s
                      ? "bg-primary-600 text-white border-primary-600"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {t(`status.${s}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          {locations && locations.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t("location")}</label>
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                <option value="">Sin ubicación</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t("tags")}</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={t("addTag")}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                onClick={handleAddTag}
                className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-700 rounded-full text-xs font-medium cursor-pointer hover:bg-primary-100"
                    onClick={() => setTags(tags.filter((t) => t !== tag))}
                  >
                    #{tag} ×
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => {
                setErrorMessage(null);
                setStep("search");
              }}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
            >
              Volver
            </button>
            <button
              onClick={handleConfirm}
              disabled={isAdding}
              className="flex-1 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
            >
              {isAdding && <Loader2 className="h-4 w-4 animate-spin" />}
              Agregar a Biblioteca
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showScanner && (
        <BarcodeScanner onScan={handleISBNScan} onClose={() => setShowScanner(false)} />
      )}
      {showCapture && (
        <CoverCapture onResult={handleCoverResult} onClose={() => setShowCapture(false)} />
      )}
    </div>
  );
}
