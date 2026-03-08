import "./../styles/globals.css";
import type { ReactNode } from "react";
import PwaRegister from "../components/PwaRegister";
import OfflineBanner from "../components/OfflineBanner";

export const metadata = {
  title: "RentLease",
  description: "Tenant applications, screening, and leasing dashboard — RentLease.App",
  manifest: "/manifest.json"
};

export const viewport = {
  themeColor: "#0f172a"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <OfflineBanner />
        <PwaRegister />
        <div className="mx-auto max-w-3xl px-4 py-6">{children}</div>
      </body>
    </html>
  );
}

