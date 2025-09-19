"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Pencil, Trash2 } from "lucide-react";

type Company = {
  id: number;
  name: string;
};

export default function CompaniesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data } = await api.get<Company[]>("/companies");
      return data;
    }
  });

  if (isLoading) return <div>Cargando...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Gestión de Empresas</h1>
      <div className="card overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50">
            <tr className="text-left">
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">Nombre</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {data?.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-4 py-2">{c.id}</td>
                <td className="px-4 py-2">{c.name}</td>
                <td className="px-4 py-2 text-right">
                  <button className="btn-secondary text-xs inline-flex items-center gap-1 mr-2">
                    <Pencil size={14} /> Editar
                  </button>
                  <button className="inline-flex items-center gap-1 rounded-md bg-red-50 text-red-600 px-3 py-2 text-xs border border-red-200 hover:bg-red-100">
                    <Trash2 size={14} /> Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {(!data || data.length === 0) && (
              <tr>
                <td className="px-4 py-6 text-center text-slate-500" colSpan={3}>
                  No hay empresas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}