"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Search, QrCode, Camera, ArrowLeft, Plus, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { booksApi, type GlobalBook, type ISBNLookupResult } from "@/lib/api/books";
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

type Step = "search" | "confirm" | "done";

export default function AddBookPage() {
  const t = useTranslations("books");
  const locale = useLocale();
  const router = useRouter();

  const [step, setStep] = useState<Step>("search");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GlobalBook[]>([]);
  const [selectedBook, setSelectedBook] = useState<GlobalBook | ISBNLookupResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showCapture, setShowCapture] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<"unread" | "reading" | "read" | "wishlist">("unread");
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const { data: locations } = useSWR<Location[]>("locations", locationsApi.list);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const results = await booksApi.search(query, 10);
      setSearchResults(results);
    } finally {
      setIsSearching(false);
    }
  };

  const handleISBNScan = async (isbn: string) => {
    setShowScanner(false);
    setIsSearching(true);
    try {
      const result = await booksApi.lookupISBN(isbn);
      if (result.found) {
        setSelectedBook(result);
        setStep("confirm");
      }
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

  const handleConfirm = async () => {
    if (!selectedBook) return;
    setIsAdding(true);

    try {
      // If it's from external lookup, create GlobalBook first
      let bookId: string;
      if (!("id" in selectedBook) || !selectedBook.id) {
        const lookup = selectedBook as ISBNLookupResult;
        const created = await booksApi.create({
          isbn: lookup.isbn ?? undefined,
          isbn13: lookup.isbn13 ?? undefined,
          title: lookup.title ?? "Título desconocido",
          author: lookup.author ?? "Autor desconocido",
          publisher: lookup.publisher ?? undefined,
          language: lookup.language ?? "es",
          cover_url: lookup.cover_url ?? undefined,
          description: lookup.description ?? undefined,
          published_year: lookup.published_year ?? undefined,
          page_count: lookup.page_count ?? undefined,
          source: (lookup.source as "openlibrary" | "googlebooks") ?? "manual",
        });
        bookId = created.id;
      } else {
        bookId = (selectedBook as GlobalBook).id;
      }

      await userBooksApi.create({
        global_book_id: bookId,
        status: selectedStatus,
        location_id: selectedLocationId || undefined,
        tags,
      });

      router.push(`/${locale}/library`);
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
            <h2 className="font-semibold text-gray-800">Buscar por título o autor</h2>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder={t("searchPlaceholder")}
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

            {/* Action buttons */}
            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button
                onClick={() => setShowScanner(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-primary-600 hover:border-primary-200 transition-colors"
              >
                <QrCode className="h-4 w-4" />
                {t("scanISBN")}
              </button>
              <button
                onClick={() => setShowCapture(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 hover:text-primary-600 hover:border-primary-200 transition-colors"
              >
                <Camera className="h-4 w-4" />
                {t("scanCover")}
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

      {step === "confirm" && selectedBook && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-6">
          {/* Book preview */}
          <div className="flex gap-4">
            <div className="relative w-20 h-28 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
              {selectedBook.cover_url ? (
                <Image src={selectedBook.cover_url} alt={selectedBook.title ?? ""} fill className="object-cover" sizes="80px" />
              ) : (
                <div className="absolute inset-0 bg-primary-50 flex items-center justify-center">
                  <span className="text-primary-400 text-2xl font-bold">
                    {(selectedBook.title ?? "?").charAt(0)}
                  </span>
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
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
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
              onClick={() => setStep("search")}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Volver
            </button>
            <button
              onClick={handleConfirm}
              disabled={isAdding}
              className="flex-1 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
