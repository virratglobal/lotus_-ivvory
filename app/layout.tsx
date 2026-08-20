import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ivory Lotus — Luxury Hospitality & Brand Experience",
  description: "Ivory Lotus luxury hospitality brand presentation and brand identity experience.",
  robots: "noindex, nofollow",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=Inter:wght@300;400;500&family=Montserrat:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Noto+Serif:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full bg-ivory text-charcoal antialiased">
        {children}
      </body>
    </html>
  );
}
