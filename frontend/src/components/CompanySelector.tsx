"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Company = { id: number; name: string };

export default function CompanySelector() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get<Company[]>("/companies");
        setCompanies(data);
      } catch {
        // ignore
      }
    };
    const current = typeof window !== "undefined" ? localStorage.getItem("sf_company_id") : null;
    setSelected(current || "");
    load();
  }, []);

  const change = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelected(val);
    if (typeof window !== "undefined") {
      if (val) localStorage.setItem("sf_company_id", val);
      else localStorage.removeItem("sf_company_id");
    }
    // refresh current page data (simple way)
    if (typeof window !== "undefined") window.location.reload();
  };

  return (
    <select className="input text-sm py-1" value={selected} onChange={change}>
      <option value="">Todas las empresas</option>
      {companies.map((c) => (
        <option key={c.id} value={c.id.toString()}>
          {c.name}
        </option>
      ))}
    </select>
  );
}