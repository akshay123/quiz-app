export const metadata = {
  title: "Multiplayer Quiz",
  description: "Admin and player app powered by Supabase"
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1
};

import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
