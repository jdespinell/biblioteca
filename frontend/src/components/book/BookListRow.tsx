"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale } from "next-intl";
import {
  Star,
  BookOpen,
  Heart,
  CheckCircle,
  Clock,
  MoreVertical,
  Trash2,
  FileText,
  MapPin,
} from "lucide-react";
import { useState } from "react";
import type { UserBook, BookStatus } from "@/lib/api/user-books";
import { userBooksApi } from "@/lib/api/user-books";

const STATUS_CONFIG: Record<
  BookStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  unread: { label: "Por Leer", color: "bg-gray-100 text-gray-700", icon: Clock },
  reading: { label: "Leyendo", color: "bg-blue-100 text-blue-800", icon: BookOpen },
  read: { label: "Leído", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle },
  wishlist: { label: "Deseado", color: "bg-amber-100 text-amber-800", icon: Heart },
};

interface BookListRowProps {
  userBook: UserBook;
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: BookStatus) => void;
}

export default function BookListRow({
  userBook,
  onDelete,
  onStatusChange,
}: BookListRowProps) {
  const locale = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { global_book, status, rating, location } = userBook;
  const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.unread;
  const StatusIcon = statusConfig.icon;

  const handleDelete = async () => {
    if (!confirm("¿Eliminar este libro de tu biblioteca?")) return;
    setIsDeleting(true);
    try {
      await userBooksApi.delete(userBook.id);
      onDelete?.(userBook.id);
    } finally {
      setIsDeleting(false);
      setMenuOpen(false);
    }
  };

  const handleStatusChange = async (newStatus: BookStatus) => {
    await userBooksApi.update(userBook.id, { status: newStatus });
    onStatusChange?.(userBook.id, newStatus);
    setMenuOpen(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-3.5 flex items-center justify-between gap-4">
      {/* Left: Cover & Info */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        <Link
          href={`/${locale}/book/${global_book.id}`}
          className="relative w-12 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 shadow-sm"
        >
          {global_book.cover_url ? (
            <Image
              src={global_book.cover_url}
              alt={global_book.title}
              fill
              className="object-cover"
              sizes="48px"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-primary-50">
              <BookOpen className="h-5 w-5 text-primary-400" />
            </div>
          )}
        </Link>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/${locale}/book/${global_book.id}`}
              className="font-bold text-gray-900 hover:text-primary-600 transition-colors text-sm truncate"
            >
              {global_book.title}
            </Link>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusConfig.color}`}
            >
              <StatusIcon className="h-3 w-3" />
              {statusConfig.label}
            </span>
          </div>

          <p className="text-xs text-gray-500 truncate">
            {global_book.author}
            {global_book.published_year ? ` · ${global_book.published_year}` : ""}
          </p>

          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap pt-0.5">
            {location && (
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-600 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-100">
                <MapPin className="h-3 w-3 text-primary-500" />
                {location.name}
              </span>
            )}

            {rating && (
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-3 w-3 ${
                      i < rating ? "fill-amber-400 text-amber-400" : "text-gray-200"
                    }`}
                  />
                ))}
              </div>
            )}

            {userBook.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href={`/${locale}/book/${global_book.id}`}
          className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 bg-gray-50 text-gray-700 text-xs font-medium rounded-lg hover:bg-primary-50 hover:text-primary-700 transition"
        >
          <FileText className="h-3.5 w-3.5 text-primary-600" />
          Notas & Detalle
        </Link>

        {/* Context menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {menuOpen && (
            <div className="absolute top-full right-0 mt-1 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-20">
              {(
                Object.entries(STATUS_CONFIG) as [
                  BookStatus,
                  (typeof STATUS_CONFIG)[BookStatus]
                ][]
              ).map(([s, cfg]) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50 transition ${
                    s === status ? "font-bold text-primary-600 bg-primary-50/50" : "text-gray-600"
                  }`}
                >
                  <cfg.icon className="h-3.5 w-3.5" />
                  {cfg.label}
                </button>
              ))}
              <div className="border-t border-gray-100 mt-1 pt-1">
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="w-full text-left px-3 py-1.5 text-xs text-red-600 flex items-center gap-2 hover:bg-red-50 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Eliminar libro
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
