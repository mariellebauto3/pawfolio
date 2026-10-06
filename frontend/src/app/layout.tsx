import type { Metadata } from "next";
import { Atkinson_Hyperlegible_Next, Zilla_Slab } from "next/font/google";
import { renderAccount } from "@/lib/auth/render-account";
import { SessionProvider } from "@/providers/session-provider";
import { ToastProvider } from "@/providers/toast-provider";
import "./globals.css";

// Font roles are set in src/styles/tokens.css (--pf-font-display, --pf-font-body).
const zillaSlab = Zilla_Slab({
  variable: "--font-zilla-slab",
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700"],
});

const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: { default: "Pawfolio", template: "%s | Pawfolio" },
  description:
    "Pets build a resume, apply to homes that fit their lifestyle, and get Hired by their future Furparent.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Loaded on the server so the shells render the right navigation for the role on the first paint, without a
  // flash of the wrong links. undefined (API unreachable) lets the browser try again.
  const lookup = await renderAccount();
  const initialAccount = lookup.ok ? lookup.account : undefined;

  return (
    <html
      lang="en"
      className={`${zillaSlab.variable} ${atkinson.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SessionProvider initialAccount={initialAccount}>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
