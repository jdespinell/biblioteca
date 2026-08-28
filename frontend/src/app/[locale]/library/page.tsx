"use client";

import { useState, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  Filter,
  Search,
  Plus,
  MapPin,
  X,
  LayoutGrid,
  List as ListIcon,
} from "lucide-react";
import Link from "next/link";
import { userBooksApi, type UserBook, type BookStatus } from "@/lib/api/user-books";
import { locationsApi, type Location } from "@/lib/api/locations";
import BookCard from "@/components/book/BookCard";
import BookListRow from "@/components/book/BookListRow";
import { useAuth } from "@/hooks/useAuth";

const STATUS_FILTERS: { value: "all" | "reading" | "unread" | "read"; label: string }[] = [
  { value: "all", label: "Todos en Biblioteca" },
  { value: "reading", label: "Leyendo" },
  { value: "unread", label: "Por Leer" },
  { value: "read", label: "Leídos" },
];

export default function LibraryPage() {
  const t = useTranslations("books");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const initialLocation = searchParams?.get("location_id") || "all";

  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [statusFilter, setStatusFilter] = useState<"all" | "reading" | "unread" | "read">("all");
  const [locationFilter, setLocationFilter] = useState<string>(initialLocation);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    const locId = searchParams?.get("location_id");
    if (locId) {
      setLocationFilter(locId);
    }
  }, [searchParams]);

  useEffect(() => {
    const saved = localStorage.getItem("library_view_mode");
    if (saved === "grid" || saved === "list") {
      setViewMode(saved);
    }
  }, []);

  const handleToggleViewMode = (mode: "grid" | "list") => {
    setViewMode(mode);
    localStorage.setItem("library_view_mode", mode);
  };

  // Load locations for filtering
  const { data: locations } = useSWR<Location[]>(
    isAuthenticated ? "locations" : null,
    locationsApi.list
  );

  const swrKey = isAuthenticated
    ? ["user-books-library", statusFilter, search, locationFilter]
    : null;

  const { data: books, isLoading } = useSWR<UserBook[]>(swrKey, () =>
    userBooksApi.list({
      status: statusFilter === "all" ? undefined : statusFilter,
      exclude_wishlist: statusFilter === "all",
      location_id: locationFilter === "all" ? undefined : locationFilter,
      search: search || undefined,
      limit: 100,
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

  const selectedLocation = locations?.find((l) => l.id === locationFilter);

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
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mi Biblioteca</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {books ? `${books.length} libros en total` : "Cargando..."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View mode switcher */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200">
            <button
              onClick={() => handleToggleViewMode("grid")}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === "grid"
                  ? "bg-white text-primary-600 shadow-sm font-semibold"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              title="Vista de Cuadrícula"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleToggleViewMode("list")}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === "list"
                  ? "bg-white text-primary-600 shadow-sm font-semibold"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              title="Vista de Lista"
            >
              <ListIcon className="h-4 w-4" />
            </button>
          </div>

          <Link
            href={`/${locale}/library/add`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-colors shadow-sm text-sm"
          >
            <Plus className="h-4 w-4" />
            {t("addBook")}
          </Link>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por título o autor en tu colección..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition"
          />
        </div>

        {/* Filter Controls: Status Pills & Location Selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
          {/* Status filter pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 scrollbar-hide">
            <Filter className="h-4 w-4 text-gray-400 flex-shrink-0 mr-1" />
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  statusFilter === f.value
                    ? "bg-primary-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Location Filter Dropdown */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 w-full sm:w-auto font-medium"
            >
              <option value="all">Todas las ubicaciones</option>
              {locations?.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  📍 {loc.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Filter Badges */}
        {(statusFilter !== "all" || locationFilter !== "all" || search) && (
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100 flex-wrap">
            <span className="text-xs text-gray-400">Filtros activos:</span>
            {statusFilter !== "all" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-primary-50 text-primary-700 font-medium">
                Estado: {STATUS_FILTERS.find((f) => f.value === statusFilter)?.label}
                <button onClick={() => setStatusFilter("all")} className="hover:text-primary-900">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {selectedLocation && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-green-50 text-green-700 font-medium">
                Ubicación: {selectedLocation.name}
                <button onClick={() => setLocationFilter("all")} className="hover:text-green-900">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {search && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700 font-medium">
                Texto: &quot;{search}&quot;
                <button onClick={() => setSearch("")} className="hover:text-gray-900">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            <button
              onClick={() => {
                setStatusFilter("all");
                setLocationFilter("all");
                setSearch("");
              }}
              className="text-xs text-primary-600 hover:underline ml-auto"
            >
              Limpiar todos
            </button>
          </div>
        )}
      </div>

      {/* Books Display: Grid vs List */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl h-64 animate-pulse border border-gray-100" />
          ))}
        </div>
      ) : books?.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 space-y-3">
          <BookOpen className="h-12 w-12 text-gray-300 mx-auto" />
          <p className="text-gray-600 font-medium">No se encontraron libros con los filtros seleccionados</p>
          <p className="text-xs text-gray-400">
            {locationFilter !== "all"
              ? "No tienes libros asignados a esta estantería todavía."
              : "Prueba cambiando el estado o agregando un nuevo libro."}
          </p>
          <div className="flex gap-2 justify-center pt-2">
            {(statusFilter !== "all" || locationFilter !== "all" || search) && (
              <button
                onClick={() => {
                  setStatusFilter("all");
                  setLocationFilter("all");
                  setSearch("");
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-xl text-xs hover:bg-gray-200 transition"
              >
                Limpiar filtros
              </button>
            )}
            <Link
              href={`/${locale}/library/add`}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white font-medium rounded-xl text-xs hover:bg-primary-700 transition shadow-sm"
            >
              <Plus className="h-4 w-4" />
              {t("addBook")}
            </Link>
          </div>
        </div>
      ) : viewMode === "grid" ? (
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
      ) : (
        <div className="space-y-2.5">
          {books?.map((userBook) => (
            <BookListRow
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
