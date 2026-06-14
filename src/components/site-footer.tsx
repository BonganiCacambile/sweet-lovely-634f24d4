import { Link } from "@tanstack/react-router";
import { Facebook, Instagram, Twitter, Youtube } from "lucide-react";

const LOGO_URL = "/logo-transparent.png";

/** Semantic 4-column site footer modeled after the Pepper Framer template. */
export function SiteFooter() {
  return (
    <footer className="w-full bg-[#ff0d3f] px-4 pb-10 pt-16 text-white sm:px-6 md:pt-20 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <Link to="/" aria-label="Sweet & Lovely home">
              <img
                src={LOGO_URL}
                alt="Sweet & Lovely"
                className="block"
                style={{ height: 58, width: "auto" }}
              />
            </Link>
            <address className="mt-5 not-italic text-sm leading-6 text-white/90">
              123 Pizza St.<br />
              Manhattan, New York, NY 10001<br />
              United States
            </address>
            <div className="mt-5 space-y-1 text-sm text-white/90">
              <p><a href="mailto:contact@sweetandlovely.pizza" className="hover:underline">contact@sweetandlovely.pizza</a></p>
              <p><a href="mailto:delivery@sweetandlovely.pizza" className="hover:underline">delivery@sweetandlovely.pizza</a></p>
            </div>
            <div className="mt-5 text-sm text-white/90">
              <p><span className="font-semibold text-white">Monday – Friday:</span> 9 AM – 10 PM</p>
              <p><span className="font-semibold text-white">Saturday:</span> 10 AM – 11 PM</p>
              <p><span className="font-semibold text-white">Sunday:</span> 10 AM – 8 PM</p>
            </div>
          </div>

          {/* Menu */}
          <nav aria-label="Menu">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/80">Menu</h2>
            <ul className="mt-5 space-y-4 text-base text-white">
              <li><Link to="/" className="hover:underline">Home</Link></li>
              <li><Link to="/menu/full-menu" className="hover:underline">Our Menu</Link></li>
              <li><Link to="/contact" className="hover:underline">Contact Us</Link></li>
            </ul>
          </nav>

          {/* Useful */}
          <nav aria-label="Useful links">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/80">Useful</h2>
            <ul className="mt-5 space-y-4 text-base text-white">
              <li><a href="#" className="hover:underline">Privacy Policy</a></li>
              <li><a href="#" className="hover:underline">Cookie Policy</a></li>
              <li><a href="#" className="hover:underline">Terms &amp; Conditions</a></li>
              <li><a href="#" className="hover:underline">Refunds &amp; Cancellation</a></li>
            </ul>
          </nav>

          {/* Social */}
          <nav aria-label="Social media">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/80">Social</h2>
            <ul className="mt-5 flex flex-wrap gap-3">
              <li>
                <a href="#" aria-label="Instagram" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 text-white transition hover:bg-white hover:text-[#ff0d3f]">
                  <Instagram className="h-4 w-4" />
                </a>
              </li>
              <li>
                <a href="#" aria-label="Facebook" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 text-white transition hover:bg-white hover:text-[#ff0d3f]">
                  <Facebook className="h-4 w-4" />
                </a>
              </li>
              <li>
                <a href="#" aria-label="Twitter" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 text-white transition hover:bg-white hover:text-[#ff0d3f]">
                  <Twitter className="h-4 w-4" />
                </a>
              </li>
              <li>
                <a href="#" aria-label="YouTube" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/40 text-white transition hover:bg-white hover:text-[#ff0d3f]">
                  <Youtube className="h-4 w-4" />
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-white/20 pt-6 text-xs text-white/80 sm:flex-row">
          <p>© {new Date().getFullYear()} Sweet &amp; Lovely. All rights reserved.</p>
          <p>Made with love in New York 🍕</p>
        </div>
      </div>
    </footer>
  );
}