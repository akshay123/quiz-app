import { Playfair_Display, Roboto } from "next/font/google";
import "./globals.css";

export const metadata = {
  title: "Multiplayer Quiz",
  description: "Admin and player app powered by Supabase"
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1
};

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-playfair"
});

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto"
});

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${playfairDisplay.variable} ${roboto.variable}`}>
      <body>{children}</body>
    </html>
  );
}
