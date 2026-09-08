"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Search,
  QrCode,
  Camera,
  ArrowLeft,
  Plus,
  Loader2,
  Edit3,
  BookOpen,
  MapPin,
  X,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { booksApi, type GlobalBook, type ISBNLookupResult, type GlobalBookCreate } from "@/lib/api/books";
import { userBooksApi } from "@/lib/api/user-books";
import { locationsApi, type Location } from "@/lib/api/locations";
import { aiApi } from "@/lib/api/ai";
import BookSummaryViewer from "@/components/book/BookSummaryViewer";
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

  // AI Summary State
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // Quick Location Creation Modal State
  const [showLocModal, setShowLocModal] = useState(false);
  const [newLocName, setNewLocName] = useState("");
  const [isCreatingLoc, setIsCreatingLoc] = useState(false);

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

  const { data: locations, mutate: mutateLocations } = useSWR<Location[]>(
    "locations",
    locationsApi.list
  );

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocName.trim()) return;
    setIsCreatingLoc(true);
    try {
      const created = await locationsApi.create({ name: newLocName.trim() });
      await mutateLocations([...(locations ?? []), created], false);
      setSelectedLocationId(created.id);
      setNewLocName("");
      setShowLocModal(false);
    } catch (err) {
      console.error("Error creating location:", err);
    } finally {
      setIsCreatingLoc(false);
    }
  };

  const handleGenerateAISummary = async (title: string, author: string) => {
    if (!title.trim()) return;
    setIsGeneratingSummary(true);
    try {
      const res = await aiApi.summarizeBook(title, author || "Autor desconocido");
      if (res?.summary) {
        if (step === "manual") {
          setManualDescription(res.summary);
        } else if (selectedBook) {
          setSelectedBook({
            ...selectedBook,
            description: res.summary,
          });
        }
      }
    } catch (err) {
      console.error("Error generating summary:", err);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleSearch = async () => {
    const clean = query.trim();
    if (!clean) return;
    setIsSearching(true);
    setErrorMessage(null);
    try {
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

  const handleCoverResult = (
    result: {
      title: string | null;
      author: string | null;
      publisher: string | null;
      isbn: string | null;
      confidence: number;
    },
    coverImage?: string | null
  ) => {
    setShowCapture(false);
    if (!result.title && !result.isbn) {
      setErrorMessage("No se pudieron identificar datos de la portada. Puedes agregarlo manualmente.");
      return;
    }

    // Directly populate the book data from the recognized photo
    const bookData: GlobalBookCreate = {
      title: result.title || "Título no identificado",
      author: result.author || "Autor desconocido",
      publisher: result.publisher || undefined,
      isbn: result.isbn || undefined,
      cover_url: coverImage || undefined,
      language: "es",
      source: "ai",
    };

    // Pre-populate manual form in case the user wants to adjust details
    setManualTitle(bookData.title);
    setManualAuthor(bookData.author);
    setManualPublisher(result.publisher || "");
    setManualIsbn(result.isbn || "");
    if (coverImage) setManualCoverUrl(coverImage);

    // Skip external search and go directly to confirm step
    setSelectedBook(bookData);
    setStep("confirm");
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
        summary: selectedBook.description || undefined,
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
                  placeholder="Ej: Cien años de soledad o Gabriel García Márquez"
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
                <h2 className="font-semibold text-gray-800">Resultados encontrados ({searchResults.length})</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {searchResults.map((book) => (
                  <button
                    key={book.id}
                    onClick={() => handleSelectBook(book)}
                    className="w-full flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="relative w-12 h-16 bg-gray-100 rounded flex-shrink-0 overflow-hidden shadow-sm mt-0.5">
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
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 leading-tight">{book.title}</p>
                      <p className="text-sm text-gray-600 mt-0.5">{book.author}</p>
                      {book.published_year && (
                        <p className="text-xs text-gray-400 mt-0.5">Año: {book.published_year}</p>
                      )}
                    </div>
                    <Plus className="h-4 w-4 text-primary-500 ml-auto flex-shrink-0 mt-1" />
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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Descripción / Sinopsis
                </label>
                <button
                  type="button"
                  onClick={() => handleGenerateAISummary(manualTitle, manualAuthor)}
                  disabled={isGeneratingSummary || !manualTitle.trim()}
                  className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1 disabled:opacity-40"
                >
                  {isGeneratingSummary ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-primary-600" />
                  )}
                  Generar resumen con IA
                </button>
              </div>
              <textarea
                rows={3}
                placeholder="Breve sinopsis o argumento del libro..."
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
                className="flex-1 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors text-sm font-semibold"
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
            <div className="relative w-20 h-28 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 shadow-sm">
              {selectedBook.cover_url ? (
                <Image
                  src={selectedBook.cover_url}
                  alt={selectedBook.title ?? ""}
                  fill
                  unoptimized={selectedBook.cover_url.startsWith("data:")}
                  className="object-cover"
                  sizes="80px"
                />
              ) : (
                <div className="absolute inset-0 bg-primary-50 flex items-center justify-center">
                  <BookOpen className="h-8 w-8 text-primary-400" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-gray-900 leading-tight">
                {selectedBook.title ?? "Título desconocido"}
              </h2>
              <p className="text-gray-600 mt-1 font-medium">{selectedBook.author}</p>
              {selectedBook.publisher && (
                <p className="text-sm text-gray-400 mt-0.5">{selectedBook.publisher}</p>
              )}
              {selectedBook.isbn && (
                <p className="text-xs font-mono text-gray-400 mt-1">ISBN: {selectedBook.isbn}</p>
              )}
              {"source" in selectedBook && (selectedBook.source === "ai" || selectedBook.source === "manual") && (
                <button
                  type="button"
                  onClick={() => setStep("manual")}
                  className="mt-2 text-xs text-primary-600 hover:text-primary-700 hover:underline flex items-center gap-1 font-medium"
                >
                  <Edit3 className="h-3 w-3" /> Editar datos del libro
                </button>
              )}
            </div>
          </div>

          {/* Synopsis / Summary */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Sinopsis / Resumen
              </label>
              <button
                type="button"
                onClick={() => handleGenerateAISummary(selectedBook.title ?? "", selectedBook.author ?? "")}
                disabled={isGeneratingSummary}
                className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1 disabled:opacity-40"
              >
                {isGeneratingSummary ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-primary-600" />
                )}
                {selectedBook.description ? "Regenerar con IA" : "Generar con IA"}
              </button>
            </div>
            {selectedBook.description ? (
              <BookSummaryViewer content={selectedBook.description} />
            ) : (
              <p className="text-xs text-gray-400 italic bg-gray-50/50 p-3 rounded-lg border border-dashed border-gray-200">
                Sin sinopsis disponible. Haz clic en &quot;Generar con IA&quot; para crear una automáticamente.
              </p>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Estado inicial</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(["unread", "reading", "read", "wishlist"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setSelectedStatus(s);
                    if (s === "wishlist") {
                      setSelectedLocationId("");
                    }
                  }}
                  className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                    selectedStatus === s
                      ? "bg-primary-600 text-white border-primary-600 shadow-sm"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {t(`status.${s}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Location Selector (Only for physical books, NOT for wishlist) */}
          {selectedStatus !== "wishlist" ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  Ubicación / Estantería Física
                </label>
                <button
                  type="button"
                  onClick={() => setShowLocModal(true)}
                  className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Nueva estantería
                </button>
              </div>
              <div className="flex gap-2">
                <select
                  value={selectedLocationId}
                  onChange={(e) => setSelectedLocationId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
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
          ) : (
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3.5 flex items-center gap-2.5 text-xs text-amber-800">
              <span className="text-base">🎁</span>
              <span>
                Este libro se guardará en tu <strong>Lista de Deseos</strong>. No requiere estantería física ya que aún no lo has adquirido.
              </span>
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
              className="flex-1 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-semibold"
            >
              {isAdding && <Loader2 className="h-4 w-4 animate-spin" />}
              Agregar a Biblioteca
            </button>
          </div>
        </div>
      )}

      {/* Quick Location Create Modal */}
      {showLocModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary-600" />
                <h3 className="font-bold text-gray-900 text-base">Nueva Estantería / Ubicación</h3>
              </div>
              <button
                onClick={() => setShowLocModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLocation} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Nombre de la ubicación
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Estante Sala, Oficina, Biblioteca"
                  value={newLocName}
                  onChange={(e) => setNewLocName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowLocModal(false)}
                  className="flex-1 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-medium hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingLoc || !newLocName.trim()}
                  className="flex-1 py-2 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-1"
                >
                  {isCreatingLoc && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Crear y Asignar
                </button>
              </div>
            </form>
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
