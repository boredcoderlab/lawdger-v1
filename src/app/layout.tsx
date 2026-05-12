import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import SyncIndicator from "@/components/SyncIndicator";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SessionProvider } from "next-auth/react";

// Initialize fonts once
const inter = Inter({ 
  subsets: ["latin"], 
  variable: "--font-inter" 
});

const playfair = Playfair_Display({ 
  subsets: ["latin"], 
  variable: "--font-playfair" 
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
      className={`${inter.variable} ${playfair.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#291e16" />
        <link rel="apple-touch-icon" href="/lawdger-logo.png" />
      </head>
      <body className={`${inter.variable} ${playfair.variable} bg-lawdger-base font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <SessionProvider>
            <SyncIndicator />
            {children}
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}