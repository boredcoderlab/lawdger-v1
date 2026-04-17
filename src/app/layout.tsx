import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import VoiceFAB from "@/components/VoiceFAB";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lawdger - Legal Second Brain",
  description: "A premium legal second brain for Indian advocates.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex bg-background text-foreground font-sans overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto relative">
          {children}
        </main>
        <VoiceFAB />
      </body>
    </html>
  );
}
