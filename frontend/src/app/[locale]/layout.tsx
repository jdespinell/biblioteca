import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import Nav from "@/components/layout/Nav";
import BottomNav from "@/components/layout/BottomNav";
import "@/app/globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    template: "%s | Mi Biblioteca",
    default: "Mi Biblioteca",
  },
  description: "Gestión de biblioteca personal con descubrimiento social",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Biblioteca",
  },
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

type Locale = (typeof routing.locales)[number];

interface RootLayoutProps {
  children: React.ReactNode;
  params: { locale: string };
}

export default async function RootLayout({
  children,
  params,
}: RootLayoutProps) {
  const { locale } = await Promise.resolve(params);

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} className="h-full">
      <body className={`${inter.className} h-full bg-gray-50 text-gray-900`}>
        <NextIntlClientProvider messages={messages}>
          <div className="min-h-full flex flex-col">
            <Nav />
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 sm:pb-24">
              {children}
            </main>
            <BottomNav />
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
