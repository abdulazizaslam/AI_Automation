import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Solar Voice Agent",
  description: "Solar lead calling dashboard"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <header className="topbar">
          <Link href="/" className="brand">
            ☀ Solar Voice Agent <span className="brand-badge">SaaS MVP</span>
          </Link>
          <nav>
            <Link href="/">Dashboard</Link>
            <Link href="/leads">Leads & Calls</Link>
          </nav>
        </header>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
