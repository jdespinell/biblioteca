"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Home,
  BookOpen,
  Heart,
  MapPin,
  Compass,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function BottomNav() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();

  const navItems = [
    {
      href: `/${locale}`,
      label: t("home"),
      icon: Home,
      exact: true,
    },
    {
      href: `/${locale}/library`,
      label: t("library"),
      icon: BookOpen,
      exact: false,
    },
    {
      href: `/${locale}/wishlist`,
      label: t("wishlist"),
      icon: Heart,
      exact: false,
    },
    {
      href: `/${locale}/locations`,
      label: t("locations"),
      icon: MapPin,
      exact: false,
    },
    {
      href: `/${locale}/discover`,
      label: t("discover"),
      icon: Compass,
      exact: false,
    },
  ];

  return (
    <nav
      aria-label="Navegación principal inferior"
      className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200/80 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="max-w-xl mx-auto px-2">
        <div className="grid grid-cols-5 h-16 items-center">
          {navItems.map((item) => {
            const isActive = item.exact
              ? pathname === item.href || pathname === `${item.href}/`
              : pathname.startsWith(item.href);

            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-col items-center justify-center h-full py-1 group transition-colors select-none ${
                  isActive
                    ? "text-primary-600 font-bold"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {/* Active Indicator Bar */}
                {isActive && (
                  <span className="absolute top-0 w-8 h-1 bg-primary-600 rounded-b-full shadow-xs" />
                )}

                <div
                  className={`p-1 rounded-xl transition-all duration-200 ${
                    isActive
                      ? "bg-primary-50/80 scale-105"
                      : "group-hover:bg-gray-50"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 transition-transform ${
                      isActive ? "stroke-[2.4]" : "stroke-[1.8]"
                    }`}
                  />
                </div>

                <span
                  className={`text-[10px] tracking-tight truncate max-w-full px-0.5 mt-0.5 leading-tight ${
                    isActive ? "font-bold text-primary-700" : "font-medium"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
