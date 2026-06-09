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
  title: "med-attest — A HIPAA consent story for your AI tool",
  description:
    "Touchless self-serve signup for the med-attest consent broker. Pilot research preview.",
  openGraph: {
    title: "med-attest — A HIPAA consent story for your AI tool",
    description:
      "Touchless self-serve signup for the med-attest consent broker.",
    siteName: "med-attest",
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
