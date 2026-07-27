import React from "react";
import { BarChart3, Boxes, Receipt } from "lucide-react";

const HIGHLIGHTS = [
  {
    icon: <Receipt className="h-4 w-4" />,
    title: "Fast checkout",
    description: "Ring up sales and print receipts in seconds.",
  },
  {
    icon: <Boxes className="h-4 w-4" />,
    title: "Live inventory",
    description: "Stock updates the moment a sale is charged.",
  },
  {
    icon: <BarChart3 className="h-4 w-4" />,
    title: "Clear reporting",
    description: "Daily, weekly and monthly sales at a glance.",
  },
];

/**
 * Split-screen shell for the sign-in page.
 *
 * The left column carries the brand story on large screens; below `lg` it drops
 * away entirely so the form gets the full viewport on a small till display.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Brand panel */}
      <aside className="relative hidden w-1/2 overflow-hidden bg-brand-950 lg:block xl:w-[55%]">
        <img
          src="/images/logo/MKB.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-sm"
        />
        {/* Brand wash + soft glows for depth */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-brand-700/95 via-brand-800/95 to-brand-950/95"
          aria-hidden="true"
        />
        <div
          className="absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-20 right-0 h-80 w-80 rounded-full bg-sky-400/10 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
          <div className="flex items-center gap-3">
            <img
              src="/images/logo/MKB.jpg"
              alt="CyberPOS logo"
              width={52}
              height={52}
              className="rounded-xl shadow-lg ring-1 ring-white/20"
            />
            <div>
              <p className="text-xl font-bold leading-tight text-white">CyberPOS</p>
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">Point of Sale</p>
            </div>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-6 max-w-lg duration-700">
            <h2 className="text-3xl font-bold leading-tight text-white xl:text-4xl">
              Everything the counter needs, on one screen.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/70">
              Sales, stock and reporting for your store — built to keep the queue
              moving.
            </p>

            <ul className="mt-9 space-y-4">
              {HIGHLIGHTS.map((item) => (
                <li key={item.title} className="flex items-start gap-3.5">
                  <span
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white ring-1 ring-white/15"
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-white">{item.title}</span>
                    <span className="block text-sm text-white/60">{item.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-white/40">
            © {new Date().getFullYear()} CyberPOS · Order and Sales Inventory Management System
          </p>
        </div>
      </aside>

      {/* Form panel */}
      <main className="relative flex w-full flex-1 items-center justify-center px-5 py-12 sm:px-8">
        {/* Subtle backdrop tint so the card lifts off the page */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(70,95,255,0.08),_transparent_60%)]"
          aria-hidden="true"
        />
        <div className="relative flex w-full justify-center">{children}</div>
      </main>
    </div>
  );
}
