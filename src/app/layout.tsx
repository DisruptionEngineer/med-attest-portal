import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Subterra — Webhooks in. Reports out.",
  description:
    "Turn webhook events from any source into branded, scheduled PDF reports. The reporting infrastructure you never have to think about.",
  openGraph: {
    title: "Subterra — Webhooks in. Reports out.",
    description:
      "Turn webhook events from any source into branded, scheduled PDF reports.",
    siteName: "Subterra",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <body
          className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased bg-[#0a0a0f] text-[#e8e8ed]`}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
