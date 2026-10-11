import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SiteLogoMark, SiteName } from "@/components/common/SiteBrand";

export function PublicHeader() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header className={`fixed top-0 inset-x-0 z-50 transition-colors duration-200 ${scrolled ? "bg-white/80 backdrop-blur-xl border-b border-[#E2E8F0]" : "bg-white/70 backdrop-blur-xl border-b border-[#E2E8F0]"}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-2">
        <Link to="/" className="flex items-center gap-2.5 min-w-0" data-testid="public-logo">
          <SiteLogoMark className="h-9 w-9 rounded-xl bg-[#0E7490] shadow-md shadow-[#0E7490]/30" iconClass="h-5 w-5 text-white" />
          <span className="font-head font-bold text-[#0A1128] text-base sm:text-lg truncate"><SiteName /></span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#475569]">
          <Link to="/" className="hover:text-[#0E7490] transition-colors duration-200">Beranda</Link>
          <Link to="/kursus" className="hover:text-[#0E7490] transition-colors duration-200" data-testid="nav-kursus">Kursus</Link>
          <Link to="/kalender" className="hover:text-[#0E7490] transition-colors duration-200" data-testid="nav-kalender">Kalender</Link>
          <Link to="/berita" className="hover:text-[#0E7490] transition-colors duration-200" data-testid="nav-berita">Berita</Link>
        </nav>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Link to="/login"><Button variant="ghost" className="text-[#475569] hover:text-[#0E7490] hover:bg-[#E6F5F8]" data-testid="public-login-btn">Masuk</Button></Link>
          <Link to="/register"><Button className="rounded-full bg-[#0E7490] hover:bg-[#0B5C74] px-4 sm:px-5" data-testid="public-register-btn">Daftar Gratis</Button></Link>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="bg-[#0A1128] text-white py-12">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <SiteLogoMark className="h-8 w-8 rounded-lg bg-[#0E7490]" iconClass="h-4 w-4 text-white" />
          <span className="font-head font-bold"><SiteName /></span>
        </div>
        <div className="flex gap-6 text-sm text-white/70">
          <Link to="/kursus" className="hover:text-white transition-colors duration-200">Kursus</Link>
          <Link to="/kalender" className="hover:text-white transition-colors duration-200">Kalender</Link>
          <Link to="/berita" className="hover:text-white transition-colors duration-200">Berita</Link>
          <Link to="/login" className="hover:text-white transition-colors duration-200">Masuk Portal</Link>
        </div>
        <p className="text-sm text-white/60">© {new Date().getFullYear()} <SiteName />.</p>
      </div>
    </footer>
  );
}

export default function PublicShell({ children }) {
  return (
    <div className="bg-white text-[#0A1128] min-h-screen flex flex-col">
      <PublicHeader />
      <main className="flex-1 pt-16">{children}</main>
      <PublicFooter />
    </div>
  );
}
