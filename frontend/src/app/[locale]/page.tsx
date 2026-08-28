"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import useSWR from "swr";
import {
  BookOpen,
  BookMarked,
  CheckCircle,
  Clock,
  Heart,
  Plus,
  Search,
  Camera,
  Sparkles,
  Lock,
  Compass,
  MapPin,
  Smartphone,
  ArrowRight,
  Star,
  Layers,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
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

function LandingPage({ locale }: { locale: string }) {
  return (
    <div className="space-y-20 py-6">
      {/* Hero Section */}
      <section className="text-center max-w-3xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary-50 border border-primary-100 text-primary-700 text-xs font-semibold uppercase tracking-wider">
          <Sparkles className="h-3.5 w-3.5" />
          Tu biblioteca personal inteligente
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 tracking-tight leading-tight">
          Organiza, descubre y reflexiona sobre tus{" "}
          <span className="bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent">
            lecturas
          </span>
        </h1>

        <p className="text-lg text-gray-600 leading-relaxed">
          El SaaS integral para catalogar tus libros personales, escanear portadas con IA de Google Gemini, tomar notas enriquecidas en Markdown con fórmulas KaTeX y descubrir lecturas de la comunidad.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href={`/${locale}/auth/register`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 shadow-md hover:shadow-lg transition-all"
          >
            Comenzar Gratis
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href={`/${locale}/discover`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-white text-gray-700 border border-gray-200 font-semibold rounded-xl hover:bg-gray-50 shadow-sm transition-all"
          >
            <Compass className="h-4 w-4 text-primary-600" />
            Explorar Feed Público
          </Link>
        </div>
      </section>

      {/* Feature Cards Grid */}
      <section className="space-y-10">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Todo lo que necesitas para tu biblioteca
          </h2>
          <p className="text-gray-500 text-sm">
            Diseñado para amantes de los libros, estudiantes e investigadores.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3 hover:shadow-md transition">
            <div className="w-12 h-12 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center">
              <Camera className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-lg text-gray-900">Reconocimiento con IA</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Toma una foto de la portada con tu cámara y Gemini 1.5 Flash Vision identificará el título, autor y metadatos en segundos.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3 hover:shadow-md transition">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
              <Layers className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-lg text-gray-900">Catálogo Normalizado</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Búsqueda por ISBN con integración automática a Open Library y Google Books para evitar libros duplicados.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3 hover:shadow-md transition">
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center">
              <MapPin className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-lg text-gray-900">Estanterías Físicas</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Organiza tus libros por ubicaciones reales (&quot;Estante Sala&quot;, &quot;Oficina&quot;, &quot;Prestado a...&quot;) para saber siempre dónde están.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3 hover:shadow-md transition">
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
              <BookMarked className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-lg text-gray-900">Markdown + KaTeX</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Editor de notas con formato enriquecido, ecuaciones matemáticas KaTeX y auto-guardado en tiempo real.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3 hover:shadow-md transition">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
              <Lock className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-lg text-gray-900">Privacidad por Defecto</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Tus notas son 100% privadas. Solo si tú lo decides, puedes publicarlas en el feed comunitario con un solo clic.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3 hover:shadow-md transition">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <Smartphone className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-lg text-gray-900">PWA Multiplataforma</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              Instálala como aplicación nativa en iOS, Android o escritorio con soporte completo en Español, Inglés y Portugués.
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Mock Preview */}
      <section className="bg-gradient-to-br from-primary-900 to-indigo-950 rounded-3xl p-8 sm:p-12 text-white space-y-8">
        <div className="max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-medium text-primary-200">
            <Sparkles className="h-3.5 w-3.5" />
            Experiencia de usuario fluida
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold">
            Tu biblioteca organizada en un solo lugar
          </h2>
          <p className="text-primary-200 text-sm leading-relaxed">
            Controla lo que estás leyendo, califica con estrellas, añade etiquetas personalizadas y lleva el seguimiento de tus libros favoritos.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">Leyendo</span>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className={`h-3 w-3 ${s <= 5 ? "fill-amber-400 text-amber-400" : "text-gray-400"}`} />
                ))}
              </div>
            </div>
            <p className="font-bold text-sm">Cien años de soledad</p>
            <p className="text-xs text-primary-200">Gabriel García Márquez</p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-500/20 text-green-300">Leído</span>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className={`h-3 w-3 ${s <= 4 ? "fill-amber-400 text-amber-400" : "text-gray-400"}`} />
                ))}
              </div>
            </div>
            <p className="font-bold text-sm">Don Quijote de la Mancha</p>
            <p className="text-xs text-primary-200">Miguel de Cervantes</p>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">Wishlist</span>
              <span className="text-xs text-primary-200">Estante Principal</span>
            </div>
            <p className="font-bold text-sm">El Aleph</p>
            <p className="text-xs text-primary-200">Jorge Luis Borges</p>
          </div>
        </div>

        <div className="text-center pt-4">
          <Link
            href={`/${locale}/auth/register`}
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-primary-900 font-bold rounded-xl hover:bg-primary-50 transition-colors shadow-lg"
          >
            Crear Mi Biblioteca Ahora
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function UserDashboard({ locale }: { locale: string }) {
  const t = useTranslations("dashboard");
  const tb = useTranslations("books");
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

export default function HomePage() {
  const locale = useLocale();
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-12">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl h-28 animate-pulse border border-gray-100" />
        ))}
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LandingPage locale={locale} />;
  }

  return <UserDashboard locale={locale} />;
}
