"use client";

import useSWR, { mutate } from "swr";
import { useLocale, useTranslations } from "next-intl";
import { Heart, ShoppingCart, Loader2, BookOpen } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { userBooksApi, type UserBook } from "@/lib/api/user-books";

function WishlistCard({ userBook, onAcquired }: { userBook: UserBook; onAcquired: (id: string) => void }) {
  const locale = useLocale();
  const { global_book } = userBook;

  const handleAcquire = async () => {
    await userBooksApi.update(userBook.id, { status: "unread" });
    onAcquired(userBook.id);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex gap-4 p-4">
      {/* Cover */}
      <Link href={`/${locale}/book/${global_book.id}`} className="flex-shrink-0">
        <div className="relative w-16 h-24 bg-gray-100 rounded-lg overflow-hidden">
          {global_book.cover_url ? (
            <Image
              src={global_book.cover_url}
              alt={global_book.title}
              fill
              unoptimized={global_book.cover_url.startsWith("data:")}
              className="object-cover"
              sizes="64px"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-amber-50 to-amber-100">
              <BookOpen className="h-8 w-8 text-amber-300" />
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <Link
            href={`/${locale}/book/${global_book.id}`}
            className="font-semibold text-gray-900 hover:text-primary-600 transition-colors line-clamp-2 leading-tight text-sm"
          >
            {global_book.title}
          </Link>
          <p className="text-xs text-gray-500 mt-0.5 truncate">{global_book.author}</p>
          {global_book.publisher && (
            <p className="text-xs text-gray-400 truncate">{global_book.publisher}</p>
          )}
        </div>

        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {userBook.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full"
            >
              #{tag}
            </span>
          ))}
          <span className="text-xs text-gray-400 ml-auto">
            {new Date(userBook.added_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Acquire button */}
      <div className="flex flex-col items-center justify-center flex-shrink-0">
        <button
          onClick={handleAcquire}
          title="Marcar como adquirido"
          className="p-2.5 rounded-xl bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700 transition-colors group"
        >
          <ShoppingCart className="h-5 w-5 group-hover:scale-110 transition-transform" />
        </button>
        <span className="text-xs text-gray-400 mt-1">Adquirir</span>
      </div>
    </div>
  );
}

import { useAuth } from "@/hooks/useAuth";

export default function WishlistPage() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const swrKey = isAuthenticated ? "user-books-wishlist" : null;
  const { data: wishlistBooks, isLoading } = useSWR<UserBook[]>(
    swrKey,
    () => userBooksApi.list({ status: "wishlist", limit: 100 })
  );

  const handleAcquired = (id: string) => {
    // Optimistically remove from wishlist
    mutate(swrKey, wishlistBooks?.filter((b) => b.id !== id), false);
  };

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm max-w-md mx-auto p-8 space-y-4">
        <Heart className="h-12 w-12 text-amber-500 mx-auto" />
        <h2 className="text-xl font-bold text-gray-900">Tu Lista de Deseos</h2>
        <p className="text-sm text-gray-500">
          Inicia sesión para guardar libros que deseas comprar o leer más adelante.
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
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-amber-100 rounded-xl">
          <Heart className="h-6 w-6 text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lista de Deseos</h1>
          <p className="text-sm text-gray-500">
            {wishlistBooks ? `${wishlistBooks.length} libros por adquirir` : "Cargando..."}
          </p>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
        </div>
      ) : wishlistBooks?.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <Heart className="h-12 w-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 mb-2">Tu lista de deseos está vacía</p>
          <p className="text-sm text-gray-400 mb-6">
            Agrega libros con estado &quot;Lista de Deseos&quot; para no olvidarlos
          </p>
          <Link
            href={`/${locale}/library/add`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-medium"
          >
            Buscar libros
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {wishlistBooks?.map((userBook) => (
            <WishlistCard
              key={userBook.id}
              userBook={userBook}
              onAcquired={handleAcquired}
            />
          ))}
        </div>
      )}
    </div>
  );
}
