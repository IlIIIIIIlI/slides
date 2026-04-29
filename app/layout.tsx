import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "K2S Studio — Knowledge to Slides",
  description: "AI-powered slide generation from any source material",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} dark`} suppressHydrationWarning>
      <body className="antialiased font-sans" suppressHydrationWarning>
        <TooltipProvider>
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
