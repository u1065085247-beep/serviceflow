"use client";

import Link from "next/link";
import { LogOut, Ticket } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const CompanySelector = dynamic(() => import("./CompanySelector"), { ssr: false });

export default function Navbar() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const me = typeof window !== "undefined" ? window.localStorage.getItem("sf_email") : null;
    setEmail(me);
  }, []);

  const logout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("sf_token");
      localStorage.removeItem("sf_email");
      localStorage.removeItem("sf_company_id");
    }
    router.push("/login");
  };

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="container-app h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/tickets" className="font-semibold text-slate-900">
            ServiceFlow
          </Link>
          <nav className="hidden md:flex items-center gap-4 text-sm text-slate-600">
            <Link href="/tickets" className="hover:text-slate-900 inline-flex items-center gap-1">
              <Ticket size={16} /> Tickets
            </Link>
            <Link href="/dashboard" className="hover:text-slate-900 inline-flex items-center gap-1">
              Dashboard
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <CompanySelector />
          <span className="hidden sm:block text-sm text-slate-600">{email}</span>
          <button className="btn-secondary" onClick={logout}>
            <LogOut size={16} />
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}