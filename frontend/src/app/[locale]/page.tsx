"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useLocale } from "next-intl";
import useSWR from "swr";
import { BookOpen, BookMarked, CheckCircle, Clock, Heart, Plus, Search } from "lucide-react";
import { useState } from "react";
import { userBooksApi, type UserBook, type UserBookStats } from "@/lib/api/user-books";
import BookCard from "@/components/book/BookCard";

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tb = useTranslations("books");
  const locale = useLocale();
  const [search, setSearch] = useState("");

  const { data: stats } = useSWR<UserBookStats>(
    "user-books-stats",
    userBooksApi.getStats
  );

  const { data: recentBooks, isLoading } = useSWR<UserBook[]>(
    ["user-books", search],
    () => userBooksApi.list({ search: search || undefined, limit: 12 })
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{t("title")}</h1>
          <p className="text-gray-500 mt-1">{t("subtitle")}</p>
        </div>
        <Link
          href={`/${locale}/library/add`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          {tb("addBook")}
        </Link>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label={t("totalBooks")}
            value={stats.total}
            icon={BookOpen}
            color="bg-primary-500"
          />
          <StatCard
            label={t("reading")}
            value={stats.reading}
            icon={BookMarked}
            color="bg-blue-500"
          />
          <StatCard
            label={t("read")}
            value={stats.read}
            icon={CheckCircle}
            color="bg-green-500"
          />
          <StatCard
            label={t("wishlist")}
            value={stats.wishlist}
            icon={Heart}
            color="bg-amber-500"
          />
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
        />
      </div>

      {/* Recent Books */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          {search ? `Resultados para "${search}"` : t("recentBooks")}
        </h2>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl h-64 animate-pulse border border-gray-100" />
            ))}
          </div>
        ) : recentBooks?.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
            <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">{t("noBooks")}</p>
            <Link
              href={`/${locale}/library/add`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {t("addFirstBook")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {recentBooks?.map((userBook) => (
              <BookCard key={userBook.id} userBook={userBook} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
