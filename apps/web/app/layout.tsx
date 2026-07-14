import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";
import "./globals.css";

// Las dos familias que globals.css ya declaraba en --font-sans / --font-serif.
// next/font las auto-aloja (sin petición a un dominio externo en la ruta
// crítica), las precarga y calcula el size-adjust del fallback: mientras la
// fuente llega, el texto se pinta con una métrica equivalente y el intercambio
// no desplaza el layout.
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const lora = Lora({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-lora",
});

export const metadata: Metadata = {
  title: {
    default: "ReadHub",
    template: "%s · ReadHub",
  },
  description: "Plataforma de publicación y lectura de artículos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${lora.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
