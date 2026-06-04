import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, Twitter, Youtube } from "lucide-react";

/** Semantic 4-column site footer modeled after the Pepper Framer template. */
export function SiteFooter() {
  return (
    <footer className="w-full bg-white px-4 pb-10 pt-16 sm:px-6 md:pt-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <Link to="/" className="text-2xl font-extrabold tracking-tight text-neutral-900">
              Sweet &amp; Lovely
            </Link>
            <address className="mt-5 not-italic text-sm leading-6 text-neutral-700">
              123 Pizza Street<br />
              Naples, NA 80100<br />
              Italy
            </address>
            <div className="mt-5 text-sm text-neutral-700">
              <p className="font-semibold text-neutral-900">Opening hours</p>
              <p className="mt-1">Mon – Fri: 11:00 – 23:00</p>
              <p>Sat – Sun: 12:00 – 00:00</p>
            </div>
          </div>

          {/* Menu */}
          <nav aria-label="Menu">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-900">Menu</h2>
            <ul className="mt-5 space-y-3 text-sm text-neutral-700">
              <li><Link to="/" className="hover:text-[#ff003c]">Home</Link></li>
              <li><Link to="/menu/full-menu" className="hover:text-[#ff003c]">Our Menu</Link></li>
              <li><Link to="/contact" className="hover:text-[#ff003c]">Contact</Link></li>
            </ul>
          </nav>

          {/* Useful */}
          <nav aria-label="Useful links">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-900">Useful Links</h2>
            <ul className="mt-5 space-y-3 text-sm text-neutral-700">
              <li><a href="#" className="hover:text-[#ff003c]">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-[#ff003c]">Cookie Policy</a></li>
              <li><a href="#" className="hover:text-[#ff003c]">Terms &amp; Conditions</a></li>
              <li><a href="#" className="hover:text-[#ff003c]">Refund Policy</a></li>
            </ul>
          </nav>

          {/* Social */}
          <nav aria-label="Social media">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-900">Follow Us</h2>
            <ul className="mt-5 flex gap-3">
              <li>
                <a href="#" aria-label="Instagram" className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 transition hover:border-[#ff003c] hover:text-[#ff003c]">
                  <Instagram className="h-4 w-4" />
                </a>
              </li>
              <li>
                <a href="#" aria-label="Facebook" className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 transition hover:border-[#ff003c] hover:text-[#ff003c]">
                  <Facebook className="h-4 w-4" />
                </a>
              </li>
              <li>
                <a href="#" aria-label="Twitter" className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 transition hover:border-[#ff003c] hover:text-[#ff003c]">
                  <Twitter className="h-4 w-4" />
                </a>
              </li>
              <li>
                <a href="#" aria-label="YouTube" className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 text-neutral-700 transition hover:border-[#ff003c] hover:text-[#ff003c]">
                  <Youtube className="h-4 w-4" />
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-neutral-200 pt-6 text-xs text-neutral-500 sm:flex-row">
          <p>© {new Date().getFullYear()} Sweet &amp; Lovely. All rights reserved.</p>
          <p>Made with love in Naples 🍕</p>
        </div>
      </div>
    </footer>
  );
}