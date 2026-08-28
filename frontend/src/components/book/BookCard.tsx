"use client";

import Image from "next/image";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
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

interface BookCardProps {
  userBook: UserBook;
  onDelete?: (id: string) => void;
  onStatusChange?: (id: string, status: BookStatus) => void;
}

export default function BookCard({ userBook, onDelete, onStatusChange }: BookCardProps) {
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
    <div className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden flex flex-col justify-between">
      <div>
        {/* Cover Image */}
        <Link
          href={`/${locale}/book/${global_book.id}`}
          className="relative block aspect-[2/3] bg-gray-100 overflow-hidden"
        >
          {global_book.cover_url ? (
            <Image
              src={global_book.cover_url}
              alt={global_book.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 text-primary-400 p-2 text-center">
              <BookOpen className="h-10 w-10 mb-1" />
              <span className="text-[11px] font-semibold leading-tight line-clamp-2">
                {global_book.title}
              </span>
            </div>
          )}

          {/* Status badge */}
          <div className="absolute top-2 left-2 shadow-sm">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold backdrop-blur-sm ${statusConfig.color}`}
            >
              <StatusIcon className="h-3 w-3" />
              {statusConfig.label}
            </span>
          </div>
        </Link>

        {/* Info */}
        <div className="p-3.5 space-y-1.5">
          <Link
            href={`/${locale}/book/${global_book.id}`}
            className="text-xs sm:text-sm font-bold text-gray-900 hover:text-primary-600 line-clamp-2 leading-snug transition-colors"
          >
            {global_book.title}
          </Link>
          <p className="text-xs text-gray-500 truncate">{global_book.author}</p>

          {/* Rating */}
          {rating && (
            <div className="flex items-center gap-0.5 pt-0.5">
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

          {/* Location pill */}
          {location && (
            <div className="flex items-center gap-1 text-[11px] text-gray-500 pt-0.5 truncate">
              <MapPin className="h-3 w-3 text-primary-500 flex-shrink-0" />
              <span className="truncate">{location.name}</span>
            </div>
          )}

          {/* Tags */}
          {userBook.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {userBook.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-medium"
                >
                  #{tag}
                </span>
              ))}
              {userBook.tags.length > 2 && (
                <span className="text-[10px] text-gray-400 font-medium self-center">
                  +{userBook.tags.length - 2}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="px-3 pb-3 pt-1 flex items-center justify-between gap-1.5 border-t border-gray-50">
        <Link
          href={`/${locale}/book/${global_book.id}`}
          className="flex-1 text-center text-xs px-2.5 py-1.5 bg-gray-50 text-gray-700 font-medium rounded-xl hover:bg-primary-50 hover:text-primary-700 transition-colors flex items-center justify-center gap-1"
        >
          <FileText className="h-3.5 w-3.5 text-primary-600" />
          Notas & Detalle
        </Link>

        {/* Context menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {menuOpen && (
            <div className="absolute bottom-full right-0 mb-1.5 w-44 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-20">
              {(
                Object.entries(STATUS_CONFIG) as [
                  BookStatus,
                  (typeof STATUS_CONFIG)[BookStatus]
                ][]
              ).map(([s, cfg]) => (
                <button
                  key={s}
                  onClick={() => handleStatusChange(s)}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-50 transition-colors ${
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
                  className="w-full text-left px-3 py-1.5 text-xs text-red-600 flex items-center gap-2 hover:bg-red-50 transition-colors"
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
