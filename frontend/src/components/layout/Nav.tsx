"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  BookOpen,
  LogOut,
  Globe,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const LOCALES = [
  { code: "es", label: "Español" },
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
] as const;

export default function Nav() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuth();
  const [langOpen, setLangOpen] = useState(false);

  const switchLocale = (newLocale: string) => {
    const segments = pathname.split("/");
    segments[1] = newLocale;
    router.push(segments.join("/"));
    setLangOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    router.push(`/${locale}/auth/login`);
  };

  const isSuperuser = isAuthenticated && !!user?.is_superuser;

  return (
    <header className="bg-white border-b border-gray-200/80 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo */}
          <Link
            href={`/${locale}`}
            className="flex items-center gap-2 text-primary-600 font-bold text-lg sm:text-xl tracking-tight"
          >
            <div className="p-1.5 bg-primary-50 rounded-xl">
              <BookOpen className="h-5 w-5 text-primary-600" />
            </div>
            <span>Biblioteca</span>
          </Link>

          {/* Right actions: Admin button, Language switcher & User Auth */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Admin Panel Link for Superusers */}
            {isSuperuser && (
              <Link
                href={`/${locale}/admin`}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition shadow-xs ${
                  pathname.includes("/admin")
                    ? "bg-indigo-600 text-white shadow-indigo-200"
                    : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                }`}
              >
                <ShieldCheck className="h-4 w-4" />
                <span className="hidden sm:inline">Panel Admin</span>
              </Link>
            )}

            {/* Language switcher */}
            <div className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                className="p-2 rounded-xl text-gray-500 hover:text-primary-600 hover:bg-gray-50 transition-colors"
                aria-label="Cambiar idioma"
              >
                <Globe className="h-4 w-4" />
              </button>
              {langOpen && (
                <div className="absolute right-0 mt-1 w-36 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50">
                  {LOCALES.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => switchLocale(l.code)}
                      className={`w-full text-left px-3.5 py-1.5 text-xs transition-colors ${
                        locale === l.code
                          ? "text-primary-600 bg-primary-50 font-bold"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Auth */}
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-700">
                  <UserIcon className="h-3.5 w-3.5 text-gray-400" />
                  <span className="font-medium max-w-[140px] truncate">
                    {user?.full_name || user?.email}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Cerrar Sesión"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href={`/${locale}/auth/login`}
                  className="text-xs font-semibold text-gray-600 hover:text-primary-600 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {t("login")}
                </Link>
                <Link
                  href={`/${locale}/auth/register`}
                  className="px-3 py-1.5 bg-primary-600 text-white text-xs font-semibold rounded-xl hover:bg-primary-700 transition shadow-xs"
                >
                  {t("register")}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
