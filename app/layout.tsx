import "./globals.css";
import Link from "next/link";

export const metadata = {
  title: "Solar Voice Agent | AI Call Center Command",
  description: "Real-time AI Outbound Calling & Lead Qualification Hub"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <header className="topbar" suppressHydrationWarning>
          <Link href="/" className="brand" suppressHydrationWarning>
            <span style={{ fontSize: "20px" }}>⚡</span>
            <span>SOLAR AI CALL CENTER</span>
            <span className="brand-badge">LIVE V2.0</span>
          </Link>

          <div className="topbar-right" suppressHydrationWarning>
            <div className="system-status-indicator" suppressHydrationWarning>
              <span className="pulse-dot" />
              <span>VOICE AI ENGINE ONLINE</span>
            </div>

            <nav suppressHydrationWarning>
              <Link href="/" className="nav-link" suppressHydrationWarning>Dashboard</Link>
              <Link href="/leads" className="nav-link" suppressHydrationWarning>Leads & Calls</Link>
            </nav>
          </div>
        </header>

        <main className="shell">{children}</main>

        <footer className="footer" suppressHydrationWarning>
          <div className="footer-content" suppressHydrationWarning>
            <div className="footer-left" suppressHydrationWarning>
              Developed by <strong>Abdul Aziz</strong> • Solar Call Center AI Automation
            </div>

            <div className="footer-links" suppressHydrationWarning>
              <a
                href="https://www.linkedin.com/in/azizi-aslam/"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-link"
                title="LinkedIn Profile"
              >
                <svg style={{ width: "15px", height: "15px", fill: "currentColor" }} viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
                <span>LinkedIn</span>
              </a>

              <a
                href="mailto:mr.azizaslam@yahoo.com"
                className="footer-link"
                title="Send Email"
              >
                <svg style={{ width: "15px", height: "15px", fill: "currentColor" }} viewBox="0 0 24 24">
                  <path d="M0 3v18h24v-18h-24zm21.518 2l-9.518 7.713-9.518-7.713h19.036zm-19.518 14v-11.817l9.518 7.713 9.518-7.713v11.817h-19.036z"/>
                </svg>
                <span>mr.azizaslam@yahoo.com</span>
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
