"use client";

import { useState, useRef } from "react";
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
  AlertTriangle,
  Check,
  Layers,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { booksApi, type GlobalBook, type ISBNLookupResult, type GlobalBookCreate } from "@/lib/api/books";
import { userBooksApi, type UserBook } from "@/lib/api/user-books";
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
type BookSource = "manual" | "openlibrary" | "googlebooks" | "ai";

const toValidSource = (src?: string | null): BookSource => {
  if (src === "openlibrary" || src === "googlebooks" || src === "ai" || src === "manual") {
    return src;
  }
  return "manual";
};

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
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [selectedStatus, setSelectedStatus] = useState<"unread" | "reading" | "read" | "wishlist">("unread");
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notFoundIsbn, setNotFoundIsbn] = useState<string | null>(null);

  // Cross-referencing & duplicate check state
  const [isCrossReferencing, setIsCrossReferencing] = useState(false);
  const [existingLibraryBook, setExistingLibraryBook] = useState<UserBook | null>(null);
  const [crossReferencedBooks, setCrossReferencedBooks] = useState<GlobalBook[]>([]);
  const [photoCoverUrl, setPhotoCoverUrl] = useState<string | null>(null);
  const [catalogCoverUrl, setCatalogCoverUrl] = useState<string | null>(null);
  const [activeCoverSource, setActiveCoverSource] = useState<"photo" | "catalog">("photo");
  const [hasCrossReferenced, setHasCrossReferenced] = useState(false);
  const [isUpdatingExistingCover, setIsUpdatingExistingCover] = useState(false);

  const handleUpdateExistingBookCover = async () => {
    if (!existingLibraryBook) return;
    const chosenCover =
      activeCoverSource === "photo" && photoCoverUrl
        ? photoCoverUrl
        : selectedBook?.cover_url || photoCoverUrl;
    if (!chosenCover) return;
    setIsUpdatingExistingCover(true);
    try {
      await booksApi.update(existingLibraryBook.global_book.id, {
        cover_url: chosenCover,
      });
      router.push(`/${locale}/book/${existingLibraryBook.global_book.id}`);
    } catch (e) {
      console.error("Error updating existing book cover:", e);
      setErrorMessage("No se pudo actualizar la portada del libro existente.");
    } finally {
      setIsUpdatingExistingCover(false);
    }
  };

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
    setNotFoundIsbn(null);
    try {
      const cleanIsbn = clean.replace(/[-\s]/g, "");
      if (/^(97[89])?\d{9}[\dX]$/i.test(cleanIsbn)) {
        const result = await booksApi.lookupISBN(cleanIsbn);
        if (result.found) {
          setSelectedBook(result);
          setStep("confirm");
          return;
        } else {
          setManualIsbn(cleanIsbn);
          setNotFoundIsbn(cleanIsbn);
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

  const checkIfBookInLibrary = async (
    title?: string | null,
    isbn?: string | null,
    author?: string | null
  ): Promise<UserBook | null> => {
    if (!title && !isbn) return null;
    try {
      // Fetch user's library (up to 500 books) for thorough in-memory comparison
      const userBooks = await userBooksApi.list({ limit: 500 });
      if (!userBooks || userBooks.length === 0) return null;

      const normalize = (s?: string | null) =>
        (s || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9\s]/g, " ")
          .replace(/\s+/g, " ")
          .trim();

      const cleanIsbn = (isbn || "").replace(/[-\s]/g, "").trim();
      const recTitleNorm = normalize(title);
      const recAuthorNorm = normalize(author);

      for (const ub of userBooks) {
        const ubIsbn = (ub.global_book.isbn || "").replace(/[-\s]/g, "").trim();
        const ubIsbn13 = (ub.global_book.isbn13 || "").replace(/[-\s]/g, "").trim();

        // 1. ISBN matching
        if (cleanIsbn && cleanIsbn.length >= 9) {
          if (
            ubIsbn === cleanIsbn ||
            ubIsbn13 === cleanIsbn ||
            (cleanIsbn.length === 10 && ubIsbn13.endsWith(cleanIsbn.slice(0, 9))) ||
            (ubIsbn.length === 10 && cleanIsbn.endsWith(ubIsbn.slice(0, 9)))
          ) {
            return ub;
          }
        }

        // 2. Title & Author matching
        const ubTitleNorm = normalize(ub.global_book.title);
        const ubAuthorNorm = normalize(ub.global_book.author);

        if (recTitleNorm && ubTitleNorm) {
          // Exact title match
          if (recTitleNorm === ubTitleNorm) {
            return ub;
          }

          // Substring title match if meaningful length
          if (
            (recTitleNorm.length >= 5 && ubTitleNorm.includes(recTitleNorm)) ||
            (ubTitleNorm.length >= 5 && recTitleNorm.includes(ubTitleNorm))
          ) {
            return ub;
          }

          // Word token overlap: if >= 2 words match and ratio >= 60%
          const recWords = recTitleNorm.split(" ").filter((w) => w.length >= 3);
          const ubWords = ubTitleNorm.split(" ").filter((w) => w.length >= 3);
          if (recWords.length >= 2 && ubWords.length >= 2) {
            const matchingWords = recWords.filter((w) => ubWords.includes(w));
            const overlapRatio = matchingWords.length / Math.min(recWords.length, ubWords.length);
            if (overlapRatio >= 0.6) {
              if (recAuthorNorm && ubAuthorNorm) {
                const authorWords = recAuthorNorm.split(" ").filter((w) => w.length >= 3);
                const ubAuthorWords = ubAuthorNorm.split(" ").filter((w) => w.length >= 3);
                const authorMatch = authorWords.some((w) => ubAuthorWords.includes(w));
                if (authorMatch) return ub;
              } else {
                return ub;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("Could not check user library for duplicates", e);
    }
    return null;
  };

  const handleISBNScan = async (isbn: string) => {
    setShowScanner(false);
    setIsSearching(true);
    setErrorMessage(null);
    setNotFoundIsbn(null);
    setExistingLibraryBook(null);

    try {
      // 1. Check if user already owns this book by ISBN
      let libraryMatch = await checkIfBookInLibrary(null, isbn);
      if (libraryMatch) {
        setExistingLibraryBook(libraryMatch);
      }

      // 2. Lookup in catalog
      const result = await booksApi.lookupISBN(isbn);
      if (result.found) {
        if (!libraryMatch && result.title) {
          libraryMatch = await checkIfBookInLibrary(result.title, isbn, result.author);
          if (libraryMatch) setExistingLibraryBook(libraryMatch);
        }
        setSelectedBook(result);
        setStep("confirm");
      } else {
        setManualIsbn(isbn);
        setNotFoundIsbn(isbn);
      }
    } catch (e) {
      console.error("ISBN scan error:", e);
      setErrorMessage("Error al consultar el ISBN. Intenta de nuevo.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleManualCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (!base64) return;

      const img = new window.Image();
      img.onload = () => {
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
          setPhotoCoverUrl(compressed);
          setActiveCoverSource("photo");
          if (selectedBook) {
            setSelectedBook({
              ...selectedBook,
              cover_url: compressed,
            });
          }
          setManualCoverUrl(compressed);
        }
      };
      img.src = base64;
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = "";
  };

  const handleSwitchCover = (source: "photo" | "catalog") => {
    setActiveCoverSource(source);
    const chosenUrl = source === "photo" ? photoCoverUrl : catalogCoverUrl;
    if (selectedBook && chosenUrl) {
      setSelectedBook({
        ...selectedBook,
        cover_url: chosenUrl,
      });
      setManualCoverUrl(chosenUrl);
    }
  };

  const handleSelectAlternativeMatch = (altBook: GlobalBook) => {
    setCatalogCoverUrl(altBook.cover_url || null);
    const chosenCover = activeCoverSource === "photo" && photoCoverUrl ? photoCoverUrl : (altBook.cover_url || photoCoverUrl);

    const merged: GlobalBookCreate = {
      title: altBook.title,
      author: altBook.author,
      publisher: altBook.publisher || undefined,
      isbn: altBook.isbn || altBook.isbn13 || undefined,
      published_year: altBook.published_year || undefined,
      page_count: altBook.page_count || undefined,
      description: altBook.description || undefined,
      language: altBook.language || "es",
      cover_url: chosenCover || undefined,
      source: toValidSource(altBook.source),
    };
    if ("id" in altBook && altBook.id) {
      (merged as any).id = altBook.id;
    }

    setSelectedBook(merged);
    setManualTitle(merged.title);
    setManualAuthor(merged.author);
    setManualPublisher(merged.publisher || "");
    setManualIsbn(merged.isbn || "");
    setManualYear(merged.published_year ? String(merged.published_year) : "");
    setManualPages(merged.page_count ? String(merged.page_count) : "");
    setManualDescription(merged.description || "");
    if (chosenCover) setManualCoverUrl(chosenCover);
  };

  const handleCoverResult = async (
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

    setIsCrossReferencing(true);
    setErrorMessage(null);
    setExistingLibraryBook(null);
    setCrossReferencedBooks([]);
    setPhotoCoverUrl(coverImage || null);
    setCatalogCoverUrl(null);
    setActiveCoverSource(coverImage ? "photo" : "catalog");

    try {
      // 1. Check if user already owns this book in their library using recognized data
      let libraryMatch = await checkIfBookInLibrary(result.title, result.isbn, result.author);
      if (libraryMatch) {
        setExistingLibraryBook(libraryMatch);
      }

      // 2. Cross-reference with Google Books and Open Library
      const normalize = (s?: string | null) =>
        (s || "")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]/g, "")
          .trim();

      const recTitleNorm = normalize(result.title);
      const cleanIsbn = (result.isbn || "").replace(/[-\s]/g, "");

      let externalMatches: GlobalBook[] = [];

      // Query by ISBN first if detected
      if (cleanIsbn) {
        try {
          const isbnRes = await booksApi.lookupISBN(cleanIsbn);
          if (isbnRes && isbnRes.found) {
            externalMatches.push(isbnRes as any);
          }
        } catch (e) {
          console.warn("ISBN lookup during cover cross-reference failed", e);
        }
      }

      // Query by Title and Author
      if (result.title) {
        try {
          const query = `${result.title} ${result.author || ""}`.trim();
          const searchRes = await booksApi.search(query, 5);
          if (searchRes && searchRes.length > 0) {
            for (const b of searchRes) {
              if (!externalMatches.some((em) => em.title.toLowerCase() === b.title.toLowerCase())) {
                externalMatches.push(b);
              }
            }
          }
        } catch (e) {
          console.warn("Search during cover cross-reference failed", e);
        }
      }

      let bestMatch: GlobalBook | null = null;
      if (externalMatches.length > 0) {
        bestMatch = externalMatches.find((b) => {
          const bTitle = normalize(b.title);
          return bTitle === recTitleNorm || bTitle.includes(recTitleNorm) || recTitleNorm.includes(bTitle);
        }) || externalMatches[0];
      }

      if (bestMatch) {
        // Re-check library with catalog's official title, ISBN, and author if not matched yet
        if (!libraryMatch) {
          const catalogMatch = await checkIfBookInLibrary(
            bestMatch.title,
            bestMatch.isbn || bestMatch.isbn13 || result.isbn,
            bestMatch.author
          );
          if (catalogMatch) {
            libraryMatch = catalogMatch;
            setExistingLibraryBook(catalogMatch);
          }
        }

        setHasCrossReferenced(true);
        setCatalogCoverUrl(bestMatch.cover_url || null);
        setCrossReferencedBooks(externalMatches);

        const chosenCover = coverImage || bestMatch.cover_url;

        const mergedBook: GlobalBookCreate = {
          title: bestMatch.title || result.title || "Título no identificado",
          author: bestMatch.author || result.author || "Autor desconocido",
          publisher: bestMatch.publisher || result.publisher || undefined,
          isbn: bestMatch.isbn || bestMatch.isbn13 || result.isbn || undefined,
          published_year: bestMatch.published_year || undefined,
          page_count: bestMatch.page_count || undefined,
          description: bestMatch.description || undefined,
          language: bestMatch.language || "es",
          cover_url: chosenCover || undefined,
          source: toValidSource(bestMatch.source),
        };

        if ("id" in bestMatch && (bestMatch as any).id) {
          (mergedBook as any).id = (bestMatch as any).id;
        }

        setSelectedBook(mergedBook);
        setManualTitle(mergedBook.title);
        setManualAuthor(mergedBook.author);
        setManualPublisher(mergedBook.publisher || "");
        setManualIsbn(mergedBook.isbn || "");
        setManualYear(mergedBook.published_year ? String(mergedBook.published_year) : "");
        setManualPages(mergedBook.page_count ? String(mergedBook.page_count) : "");
        setManualDescription(mergedBook.description || "");
        if (chosenCover) setManualCoverUrl(chosenCover);
      } else {
        if (!libraryMatch) {
          const checkAgain = await checkIfBookInLibrary(result.title, result.isbn, result.author);
          if (checkAgain) {
            setExistingLibraryBook(checkAgain);
          }
        }

        setHasCrossReferenced(false);
        setCatalogCoverUrl(null);
        setCrossReferencedBooks([]);

        const bookData: GlobalBookCreate = {
          title: result.title || "Título no identificado",
          author: result.author || "Autor desconocido",
          publisher: result.publisher || undefined,
          isbn: result.isbn || undefined,
          cover_url: coverImage || undefined,
          language: "es",
          source: "ai",
        };

        setSelectedBook(bookData);
        setManualTitle(bookData.title);
        setManualAuthor(bookData.author);
        setManualPublisher(result.publisher || "");
        setManualIsbn(result.isbn || "");
        if (coverImage) setManualCoverUrl(coverImage);
      }

      setStep("confirm");
    } finally {
      setIsCrossReferencing(false);
    }
  };

  const handleSelectBook = async (book: GlobalBook) => {
    setSelectedBook(book);
    setExistingLibraryBook(null);
    const libraryMatch = await checkIfBookInLibrary(book.title, book.isbn || book.isbn13, book.author);
    if (libraryMatch) {
      setExistingLibraryBook(libraryMatch);
    }
    setStep("confirm");
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput("");
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim() || !manualAuthor.trim()) {
      setErrorMessage("El título y el autor son obligatorios.");
      return;
    }
    setErrorMessage(null);
    setExistingLibraryBook(null);
    const libraryMatch = await checkIfBookInLibrary(manualTitle.trim(), manualIsbn.trim(), manualAuthor.trim());
    if (libraryMatch) {
      setExistingLibraryBook(libraryMatch);
    }
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
    if (existingLibraryBook) {
      setErrorMessage(
        `Este libro ya está en tu biblioteca ('${existingLibraryBook.global_book.title}'). Puedes ver tu copia registrada o actualizar su portada con el botón correspondiente.`
      );
      return;
    }
    setIsAdding(true);
    setErrorMessage(null);

    try {
      let bookId: string;

      const rawIsbn = (selectedBook as any).isbn;
      const rawIsbn13 = (selectedBook as any).isbn13;
      const cleanIsbn = rawIsbn ? String(rawIsbn).replace(/[-\s]/g, "").trim() : undefined;
      const cleanIsbn13 = rawIsbn13 ? String(rawIsbn13).replace(/[-\s]/g, "").trim() : undefined;

      const finalIsbn10 = cleanIsbn && cleanIsbn.length === 10 ? cleanIsbn : (cleanIsbn13 && cleanIsbn13.length === 10 ? cleanIsbn13 : undefined);
      const finalIsbn13 = cleanIsbn13 && cleanIsbn13.length === 13 ? cleanIsbn13 : (cleanIsbn && cleanIsbn.length === 13 ? cleanIsbn : undefined);

      if ("id" in selectedBook && selectedBook.id) {
        bookId = selectedBook.id;
        // Update cover and ISBN on existing GlobalBook if user added/changed cover
        if (selectedBook.cover_url || finalIsbn10 || finalIsbn13) {
          try {
            await booksApi.update(bookId, {
              cover_url: selectedBook.cover_url || undefined,
              isbn: finalIsbn10,
              isbn13: finalIsbn13,
            });
          } catch (e) {
            console.warn("Could not update GlobalBook details:", e);
          }
        }
      } else {
        const bookData = selectedBook as GlobalBookCreate;
        const created = await booksApi.create({
          isbn: finalIsbn10,
          isbn13: finalIsbn13,
          title: bookData.title || "Título desconocido",
          author: bookData.author || "Autor desconocido",
          publisher: bookData.publisher || undefined,
          language: bookData.language || "es",
          cover_url: bookData.cover_url || undefined,
          published_year: bookData.published_year || undefined,
          page_count: bookData.page_count || undefined,
          source: toValidSource(bookData.source),
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

            {notFoundIsbn && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0 mt-0.5">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 text-sm">
                      Libro no indexado en bases públicas externas
                    </h4>
                    <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                      El ISBN <strong>{notFoundIsbn}</strong> existe en tu libro, pero Open Library y Google Books no tienen esta edición registrada (frecuente en editoriales de España y Latinoamérica).
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setManualIsbn(notFoundIsbn);
                          setStep("manual");
                          setNotFoundIsbn(null);
                        }}
                        className="px-3.5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
                      >
                        <Plus className="h-4 w-4" />
                        Registrar libro con este ISBN
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCapture(true);
                          setNotFoundIsbn(null);
                        }}
                        className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-xs font-semibold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
                      >
                        <Camera className="h-4 w-4 text-primary-600" />
                        Tomar foto a la portada (detectar con IA)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {errorMessage && !notFoundIsbn && (
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

          {/* Library Duplicate Alert */}
          {existingLibraryBook && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 flex-shrink-0 mt-0.5">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="bg-amber-200 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      ¡Ya lo tienes!
                    </span>
                    <span className="text-xs text-amber-800 font-medium">Este libro ya está en tu biblioteca</span>
                  </div>
                  <h4 className="text-sm font-bold text-gray-900 mt-1 truncate">
                    {existingLibraryBook.global_book.title}
                  </h4>
                  <p className="text-xs text-gray-600">
                    {existingLibraryBook.global_book.author}
                  </p>

                  <div className="mt-2.5 flex flex-wrap gap-2 text-xs bg-white/80 p-2 rounded-lg border border-amber-200/60">
                    <div>
                      <span className="text-gray-500">Estado: </span>
                      <span className="font-semibold text-gray-800 capitalize">
                        {existingLibraryBook.status === "unread" ? "Por leer" : existingLibraryBook.status === "reading" ? "Leyendo" : existingLibraryBook.status === "read" ? "Leído" : "En lista de deseos"}
                      </span>
                    </div>
                    {existingLibraryBook.location && (
                      <>
                        <span className="text-gray-300">•</span>
                        <div>
                          <span className="text-gray-500">Ubicación: </span>
                          <span className="font-semibold text-gray-800">{existingLibraryBook.location.name}</span>
                        </div>
                      </>
                    )}
                    {existingLibraryBook.rating && (
                      <>
                        <span className="text-gray-300">•</span>
                        <div>
                          <span className="font-semibold text-amber-600">★ {existingLibraryBook.rating}/5</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/${locale}/book/${existingLibraryBook.global_book.id}`}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      Ver mi copia registrada
                    </Link>
                    {(photoCoverUrl || selectedBook.cover_url) && (
                      <button
                        type="button"
                        onClick={handleUpdateExistingBookCover}
                        disabled={isUpdatingExistingCover}
                        className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
                      >
                        {isUpdatingExistingCover ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Camera className="h-3.5 w-3.5" />
                        )}
                        Actualizar portada de mi libro con esta foto
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setExistingLibraryBook(null)}
                      className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 font-medium hover:bg-amber-100/60 rounded-xl transition-colors"
                    >
                      Continuar de todos modos
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Missing Cover Photo Banner - Prominent prompt when book has no cover */}
          {!selectedBook.cover_url && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-600 flex-shrink-0">
                  <Camera className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-blue-200 text-blue-900 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Sin portada
                    </span>
                    <h4 className="text-sm font-bold text-gray-900">
                      ¿Quieres tomar una foto de la portada?
                    </h4>
                  </div>
                  <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                    Este libro no incluye foto de portada en los catálogos. Puedes fotografiar tu libro ahora mismo antes de guardarlo.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 flex-shrink-0 cursor-pointer"
              >
                <Camera className="h-4 w-4" />
                Tomar foto de portada
              </button>
            </div>
          )}

          {/* Cross-reference success pill */}
          {hasCrossReferenced && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0 mt-0.5">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 text-xs">
                <p className="font-semibold text-emerald-900">
                  Datos cruzados con Google Books y Open Library
                </p>
                <p className="text-emerald-700 mt-0.5 leading-relaxed">
                  Completamos automáticamente la información oficial (año, páginas, sinopsis y portada de editorial).
                </p>
              </div>
            </div>
          )}

          {/* Cover Selector: Photo vs Official Catalog Cover */}
          {photoCoverUrl && catalogCoverUrl && photoCoverUrl !== catalogCoverUrl && (
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-gray-700">
                  ¿Qué portada prefieres guardar?
                </label>
                <span className="text-[11px] text-gray-500">Toca para elegir</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleSwitchCover("photo")}
                  className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all ${
                    activeCoverSource === "photo"
                      ? "border-primary-600 bg-white shadow-sm ring-2 ring-primary-500/20"
                      : "border-gray-200 bg-white/60 hover:bg-white text-gray-600"
                  }`}
                >
                  <div className="relative w-9 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 shadow-xs">
                    <Image src={photoCoverUrl} alt="Tu foto" fill unoptimized className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-900 truncate">Tu foto</p>
                    <p className="text-[10px] text-gray-500">De la cámara</p>
                    {activeCoverSource === "photo" && (
                      <span className="text-[10px] text-primary-700 font-bold flex items-center gap-0.5 mt-0.5">
                        <Check className="h-3 w-3" /> Usando esta
                      </span>
                    )}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchCover("catalog")}
                  className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all ${
                    activeCoverSource === "catalog"
                      ? "border-primary-600 bg-white shadow-sm ring-2 ring-primary-500/20"
                      : "border-gray-200 bg-white/60 hover:bg-white text-gray-600"
                  }`}
                >
                  <div className="relative w-9 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 shadow-xs">
                    <Image src={catalogCoverUrl} alt="Portada oficial" fill unoptimized className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-900 truncate">Oficial</p>
                    <p className="text-[10px] text-gray-500">De editorial</p>
                    {activeCoverSource === "catalog" && (
                      <span className="text-[10px] text-primary-700 font-bold flex items-center gap-0.5 mt-0.5">
                        <Check className="h-3 w-3" /> Usando esta
                      </span>
                    )}
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Alternative Catalog Matches */}
          {crossReferencedBooks.length > 1 && (
            <div className="bg-gray-50/70 rounded-xl border border-gray-200/80 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-primary-600" />
                  Otras ediciones encontradas en catálogo:
                </span>
                <span className="text-[10px] text-gray-400">({crossReferencedBooks.length} resultados)</span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {crossReferencedBooks.map((b, idx) => {
                  const isCurrent = selectedBook.title === b.title && selectedBook.author === b.author;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectAlternativeMatch(b)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors ${
                        isCurrent
                          ? "bg-primary-50 text-primary-900 font-semibold border border-primary-200"
                          : "bg-white hover:bg-gray-100 text-gray-700 border border-gray-100"
                      }`}
                    >
                      <div className="min-w-0 flex-1 truncate pr-2">
                        <span className="truncate">{b.title}</span>
                        {b.published_year && (
                          <span className="text-gray-400 font-normal ml-1">({b.published_year})</span>
                        )}
                      </div>
                      {isCurrent ? (
                        <span className="text-[10px] text-primary-700 font-bold">Seleccionado</span>
                      ) : (
                        <span className="text-[10px] text-gray-400 hover:text-primary-600">Elegir</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Book preview */}
          <div className="flex gap-4 items-start">
            <div className="relative w-24 h-36 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0 shadow-md border border-gray-200 group">
              {selectedBook.cover_url ? (
                <>
                  <Image
                    src={selectedBook.cover_url}
                    alt={selectedBook.title ?? ""}
                    fill
                    unoptimized={selectedBook.cover_url.startsWith("data:")}
                    className="object-cover"
                    sizes="96px"
                  />
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity p-1 text-center backdrop-blur-xs"
                    title="Cambiar foto de portada"
                  >
                    <Camera className="h-5 w-5 mb-0.5" />
                    <span className="text-[10px] font-bold">Cambiar foto</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="w-full h-full bg-gradient-to-br from-primary-50 to-primary-100/70 hover:bg-primary-100 flex flex-col items-center justify-center text-primary-600 p-2 text-center transition-colors border-2 border-dashed border-primary-300 hover:border-primary-500 rounded-xl"
                  title="Tomar o subir foto de portada"
                >
                  <Camera className="h-7 w-7 mb-1 text-primary-500 animate-pulse" />
                  <span className="text-[10px] font-bold leading-tight">Tomar foto de portada</span>
                </button>
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

              {/* ISBN badge */}
              {((selectedBook as any).isbn || (selectedBook as any).isbn13) && (
                <p className="text-xs font-mono text-gray-500 mt-1.5 flex items-center gap-1.5">
                  <span className="bg-gray-100 text-gray-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-gray-200">
                    ISBN
                  </span>
                  <span className="font-semibold text-gray-800">
                    {(selectedBook as any).isbn13 || (selectedBook as any).isbn}
                  </span>
                </p>
              )}

              {/* Action buttons */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-primary-50 hover:bg-primary-100 text-primary-700 transition-colors border border-primary-200 shadow-xs"
                >
                  <Camera className="h-3.5 w-3.5" />
                  {selectedBook.cover_url ? "Cambiar foto de portada" : "Tomar foto de portada"}
                </button>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleManualCoverUpload}
                />

                <button
                  type="button"
                  onClick={() => setStep("manual")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
                >
                  <Edit3 className="h-3.5 w-3.5" /> Editar datos
                </button>
              </div>
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

      {/* Modals & Overlays */}
      {isCrossReferencing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-primary-50 mx-auto flex items-center justify-center text-primary-600 shadow-inner">
              <Loader2 className="h-7 w-7 animate-spin text-primary-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">Cruzando información...</h3>
              <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                Verificando si ya tienes este libro en tu biblioteca y buscando datos oficiales en Google Books y Open Library.
              </p>
            </div>
          </div>
        </div>
      )}

      {showScanner && (
        <BarcodeScanner onScan={handleISBNScan} onClose={() => setShowScanner(false)} />
      )}
      {showCapture && (
        <CoverCapture onResult={handleCoverResult} onClose={() => setShowCapture(false)} />
      )}
    </div>
  );
}
