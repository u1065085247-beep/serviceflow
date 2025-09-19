"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Me = {
  id: number;
  email: string;
  full_name?: string | null;
  role: "superadmin" | "admin" | "tech" | "user";
  company_id: number;
};

export default function CreateTechPage() {
  const router = useRouter();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await api.get<Me>("/auth/me");
      return data;
    },
  });

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    is_active: true,
    can_view_all_companies: false,
  });
  const [saving, setSaving] = useState(false);

  if (me.isLoading) return <div>Cargando...</div>;
  if (me.error) return <div>Error cargando el usuario actual.</div>;

  const current = me.data!;
  const isAdmin = current.role === "admin";

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      alert("Solo el administrador puede crear técnicos.");
      return;
    }
    if (!form.email || !form.password) {
      alert("Email y contraseña son obligatorios.");
      return;
    }
    setSaving(true);
    try {
      await api.post("/users", {
        full_name: form.full_name || null,
        email: form.email,
        role: "tech",
        company_id: current.company_id, // el backend lo forzará igualmente para admin
        is_active: form.is_active,
        can_view_all_companies: form.can_view_all_companies,
        password: form.password,
      });
      alert("Técnico creado correctamente.");
      router.push("/users");
    } catch (err: any) {
      alert("No se pudo crear el técnico.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Crear Técnico</h1>
        <p className="text-sm text-slate-500">
          Solo el administrador de la empresa puede crear técnicos. El técnico quedará asignado a tu empresa.
        </p>
      </div>

      <form onSubmit={onSubmit} className="card p-4 space-y-4 max-w-xl">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-600">Nombre</span>
          <input
            className="input"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            placeholder="Nombre y apellidos"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-600">Email</span>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="tecnico@empresa.com"
            required
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-600">Contraseña</span>
          <input
            className="input"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Mínimo 8 caracteres"
            required
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="accent-brand-600"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            <span className="text-sm text-slate-700">Usuario activo</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="accent-brand-600"
              checked={form.can_view_all_companies}
              onChange={(e) => setForm({ ...form, can_view_all_companies: e.target.checked })}
            />
            <span className="text-sm text-slate-700">Puede ver todas las empresas</span>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button className="btn" type="submit" disabled={saving}>
            {saving ? "Creando..." : "Crear Técnico"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => router.push("/users")}>
            Cancelar
          </button>
        </div>

        <div className="text-xs text-slate-500">
          Empresa destino: <span className="font-medium">{current.company_id}</span> (asignada automáticamente).
        </div>
      </form>
    </div>
  );
}