"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Providers from "@/components/Providers";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("sf_token") : null;
    if (!token) {
      router.replace("/login");
    }
  }, [router]);

  return (
    <Providers>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 container-app py-6">{children}</main>
        </div>
      </div>
    </Providers>
  );
}