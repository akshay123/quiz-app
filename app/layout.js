export const metadata = {
  title: "Multiplayer Quiz",
  description: "Admin and player app powered by Supabase"
};

import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
