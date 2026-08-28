"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { useLocale, useTranslations } from "next-intl";
import { BookOpen, Filter, Search, Plus } from "lucide-react";
import Link from "next/link";
import { userBooksApi, type UserBook, type BookStatus } from "@/lib/api/user-books";
import BookCard from "@/components/book/BookCard";

import { useAuth } from "@/hooks/useAuth";

const STATUS_FILTERS: { value: BookStatus | "all"; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "unread", label: "Por Leer" },
  { value: "reading", label: "Leyendo" },
  { value: "read", label: "Leídos" },
  { value: "wishlist", label: "Wishlist" },
];

export default function LibraryPage() {
  const t = useTranslations("books");
  const locale = useLocale();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [statusFilter, setStatusFilter] = useState<BookStatus | "all">("all");
  const [search, setSearch] = useState("");

  const swrKey = isAuthenticated ? ["user-books-library", statusFilter, search] : null;

  const { data: books, isLoading } = useSWR<UserBook[]>(swrKey, () =>
    userBooksApi.list({
      status: statusFilter === "all" ? undefined : statusFilter,
      search: search || undefined,
      limit: 50,
    })
  );

  const handleDelete = (id: string) => {
    mutate(swrKey, books?.filter((b) => b.id !== id), false);
  };

  const handleStatusChange = (id: string, newStatus: BookStatus) => {
    mutate(
      swrKey,
      books?.map((b) => (b.id === id ? { ...b, status: newStatus } : b)),
      false
    );
  };

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm max-w-md mx-auto p-8 space-y-4">
        <BookOpen className="h-12 w-12 text-primary-500 mx-auto" />
        <h2 className="text-xl font-bold text-gray-900">Tu Biblioteca Personal</h2>
        <p className="text-sm text-gray-500">
          Inicia sesión o crea una cuenta gratis para catalogar tus libros, gestionar estanterías y tomar notas.
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <Link
            href={`/${locale}/auth/login`}
            className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 text-sm transition"
          >
            Iniciar Sesión
          </Link>
          <Link
            href={`/${locale}/auth/register`}
            className="px-5 py-2.5 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 text-sm transition shadow-sm"
          >
            Crear Cuenta
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">{t("addBook") === "Agregar Libro" ? "Mi Biblioteca" : "My Library"}</h1>
        <Link
          href={`/${locale}/library/add`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {t("addBook")}
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder={t("searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition"
          />
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <Filter className="h-4 w-4 text-gray-400 flex-shrink-0" />
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === f.value
                  ? "bg-primary-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Books grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl h-64 animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : books?.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">{t("noBooks")}</p>
          <Link
            href={`/${locale}/library/add`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            {t("addBook")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {books?.map((userBook) => (
            <BookCard
              key={userBook.id}
              userBook={userBook}
              onDelete={handleDelete}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
