import type { Metadata } from "next";
import { Inter, Roboto_Mono, Syne } from "next/font/google"; // [NEW] Syne
import "./globals.css";

const sansFont = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const monoFont = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

// [NEW] Syne font for headers
const festiveFont = Syne({
  subsets: ["latin"],
  variable: "--font-festive",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Examen Proctor",
  description: "Plataforma de exámenes con antifraude",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={`${sansFont.variable} ${monoFont.variable} ${festiveFont.variable}`}>
        {children}
      </body>
    </html>
  );
}

