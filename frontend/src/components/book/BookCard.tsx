"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Star, BookOpen, Heart, CheckCircle, Clock, MoreVertical, Trash2, FileText } from "lucide-react";
import { useState } from "react";
import type { UserBook, BookStatus } from "@/lib/api/user-books";
import { userBooksApi } from "@/lib/api/user-books";

const STATUS_CONFIG: Record<
  BookStatus,
  { label: string; color: string; icon: React.ElementType }
> = {
  unread:  { label: "Por Leer",        color: "bg-gray-100 text-gray-600",    icon: Clock },
  reading: { label: "Leyendo",         color: "bg-blue-100 text-blue-700",   icon: BookOpen },
  read:    { label: "Leído",           color: "bg-green-100 text-green-700", icon: CheckCircle },
  wishlist:{ label: "Lista de Deseos", color: "bg-amber-100 text-amber-700", icon: Heart },
};

interface BookCardProps {
  userBook: UserBook;
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: BookStatus) => void;
}

export default function BookCard({ userBook, onDelete, onStatusChange }: BookCardProps) {
  const locale = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { global_book, status, rating } = userBook;
  const statusConfig = STATUS_CONFIG[status];
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
    <div className="group bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col">
      {/* Cover Image */}
      <Link href={`/${locale}/book/${global_book.id}`} className="relative block aspect-[2/3] bg-gray-100">
        {global_book.cover_url ? (
          <Image
            src={global_book.cover_url}
            alt={global_book.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary-100 to-primary-200">
            <BookOpen className="h-12 w-12 text-primary-400" />
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-2 left-2">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
            <StatusIcon className="h-3 w-3" />
          </span>
        </div>
      </Link>

      {/* Info */}
      <div className="p-3 flex flex-col gap-1 flex-1">
        <Link
          href={`/${locale}/book/${global_book.id}`}
          className="text-sm font-semibold text-gray-900 hover:text-primary-600 line-clamp-2 leading-tight"
        >
          {global_book.title}
        </Link>
        <p className="text-xs text-gray-500 truncate">{global_book.author}</p>

        {/* Rating */}
        {rating && (
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`h-3 w-3 ${i < rating ? "fill-amber-400 text-amber-400" : "text-gray-200"}`}
              />
            ))}
          </div>
        )}

        {/* Tags */}
        {userBook.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {userBook.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-3 pb-3 flex items-center justify-between gap-2">
        <Link
          href={`/${locale}/book/${global_book.id}`}
          className="flex-1 text-center text-xs px-2 py-1.5 bg-gray-50 text-gray-600 rounded-lg hover:bg-primary-50 hover:text-primary-600 transition-colors"
        >
          <FileText className="h-3 w-3 inline mr-1" />
          Notas
        </Link>

        {/* Context menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {menuOpen && (
            <div className="absolute bottom-full right-0 mb-1 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
              {(Object.entries(STATUS_CONFIG) as [BookStatus, typeof STATUS_CONFIG[BookStatus]][]).map(
                ([s, cfg]) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50 transition-colors ${
                      s === status ? "font-semibold text-primary-600" : "text-gray-600"
                    }`}
                  >
                    <cfg.icon className="h-3 w-3" />
                    {cfg.label}
                  </button>
                )
              )}
              <div className="border-t border-gray-100 mt-1 pt-1">
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="w-full text-left px-3 py-1.5 text-xs text-red-600 flex items-center gap-2 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                  Eliminar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
