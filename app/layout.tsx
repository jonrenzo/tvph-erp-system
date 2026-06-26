import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "TelcoVantage Philippines",
  description: "Enterprise Resource Planning System",
  icons: {
    icon: "/logo.svg",
  },
};

import { ThemeProvider } from "@/components/theme-provider";
import { AccentProvider } from "@/components/accent-provider";
import { Toaster } from "sonner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col font-sans">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
          themes={["light", "dark", "midnight"]}
        >
          <AccentProvider>
            {children}
          </AccentProvider>
          <Toaster position="top-right" richColors toastOptions={{ style: { zIndex: 9999 } }} />
        </ThemeProvider>
      </body>
    </html>
  );
}
