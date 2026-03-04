import "./../styles/globals.css";
import type { ReactNode } from "react";
import PwaRegister from "../components/PwaRegister";

export const metadata = {
  title: "Bannerman Leasing",
  description: "Tenant applications and leasing dashboard for The Bannerman Group",
  themeColor: "#0f172a",
  manifest: "/manifest.json"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <PwaRegister />
        <div className="mx-auto max-w-3xl px-4 py-6">{children}</div>
      </body>
    </html>
  );
}

