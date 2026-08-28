"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import { useLocale, useTranslations } from "next-intl";
import { BookOpen, Filter, Search, Plus } from "lucide-react";
import Link from "next/link";
import { userBooksApi, type UserBook, type BookStatus } from "@/lib/api/user-books";
import BookCard from "@/components/book/BookCard";

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
  const [statusFilter, setStatusFilter] = useState<BookStatus | "all">("all");
  const [search, setSearch] = useState("");

  const swrKey = ["user-books-library", statusFilter, search];

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
