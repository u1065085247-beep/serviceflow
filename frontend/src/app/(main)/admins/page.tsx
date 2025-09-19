"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Eye, Loader2, Pencil, Trash2, UserPlus } from "lucide-react";

type User = {
  id: number;
  email: string;
  full_name?: string | null;
  role: "superadmin" | "admin" | "tech" | "user";
  company_id: number;
  is_active: boolean;
  can_view_all_companies: boolean;
};

type Company = { id: number; name: string };

function Avatar({ name }: { name: string }) {
  const initials = useMemo(() => {
    const parts = (name || "").trim().split(" ");
    const a = parts[0]?.[0] || "";
    const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (a + b).toUpperCase() || "A";
  }, [name]);
  return <div className="h-10 w-10 rounded-full bg-brand-600 text-white grid place-items-center text-sm font-semibold">{initials}</div>;
}

export default function AdminsPage() {
  const qc = useQueryClient();

  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await api.get<User>("/auth/me");
      return data;
    }
  });

  const admins = useQuery({
    queryKey: ["admins"],
    queryFn: async () => {
      const { data } = await api.get<User[]>("/users", { params: { role_filter: "admin" } });
      return data;
    },
    enabled: !!me.data && me.data.role === "superadmin",
    refetchInterval: 30000
  });

  const companies = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data } = await api.get<Company[]>("/companies");
      return data;
    },
    enabled: !!me.data && me.data.role === "superadmin"
  });

  const [showForm, setShowForm] = useState<null | { mode: "create" | "edit"; user?: User }>(null);
  const [viewUser, setViewUser] = useState<User | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null);

  const delUser = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: async () => {
      setConfirmDelete(null);
      await qc.invalidateQueries({ queryKey: ["admins"] });
    }
  });

  if (me.isLoading) return <div>Cargando...</div>;
  if (me.data?.role !== "superadmin") {
    return <div className="text-sm text-slate-600">Acceso restringido. Solo el root (superadmin) puede administrar administradores.</div>;
  }
  if (admins.isLoading) return <div>Cargando administradores...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Administración de Administradores</h1>
          <p className="text-sm text-slate-500">Gestiona los usuarios con permisos administrativos del sistema.</p>
        </div>
        <button className="btn inline-flex items-center gap-2" onClick={() => setShowForm({ mode: "create" })}>
          <UserPlus size={16} /> Nuevo Administrador
        </button>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {admins.data?.map((u) => (
          <div key={u.id} className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar name={u.full_name || u.email} />
                <div>
                  <div className="font-medium">{u.full_name || u.email}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </div>
              </div>
              <span className="text-xs px-2 py-1 rounded-full border">Administrador</span>
            </div>

            <div className="text-xs text-slate-600">
              Empresa: {companies.data?.find((c) => c.id === u.company_id)?.name || u.company_id} · Estado:{" "}
              <span className={"px-2 py-0.5 rounded-full border " + (u.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200")}>
                {u.is_active ? "Activo" : "Inactivo"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button className="btn-secondary text-sm inline-flex items-center gap-1" onClick={() => setViewUser(u)}>
                <Eye size={14} /> Ver
              </button>
              <button className="btn-secondary text-sm inline-flex items-center gap-1" onClick={() => setShowForm({ mode: "edit", user: u })}>
                <Pencil size={14} /> Editar
              </button>
              <button
                className="inline-flex items-center gap-1 rounded-md bg-red-50 text-red-600 px-3 py-2 text-sm border border-red-200 hover:bg-red-100"
                onClick={() => setConfirmDelete(u)}
              >
                <Trash2 size={14} /> Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <AdminForm
          mode={showForm.mode}
          user={showForm.user}
          companies={companies.data || []}
          onClose={() => setShowForm(null)}
          onSaved={async () => {
            setShowForm(null);
            await qc.invalidateQueries({ queryKey: ["admins"] });
          }}
        />
      )}

      {viewUser && (
        <ViewDialog title="Detalles de Administrador" onClose={() => setViewUser(null)}>
          <div className="flex items-center gap-3">
            <Avatar name={viewUser.full_name || viewUser.email} />
            <div>
              <div className="font-medium">{viewUser.full_name || viewUser.email}</div>
              <div className="text-slate-500">{viewUser.email}</div>
            </div>
          </div>
          <div className="text-sm mt-3">
            Empresa:{" "}
            <span className="font-medium">{companies.data?.find((c) => c.id === viewUser.company_id)?.name || viewUser.company_id}</span>
          </div>
          <div className="text-sm">Estado: <span className="font-medium">{viewUser.is_active ? "Activo" : "Inactivo"}</span></div>
        </ViewDialog>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Eliminar administrador"
          description={`¿Seguro que deseas eliminar a ${confirmDelete.full_name || confirmDelete.email}?`}
          confirmText="Eliminar"
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => delUser.mutate(confirmDelete.id)}
          loading={delUser.isPending}
        />
      )}
    </div>
  );
}

function AdminForm({
  mode,
  user,
  companies,
  onClose,
  onSaved
}: {
  mode: "create" | "edit";
  user?: User;
  companies: Company[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [form, setForm] = useState({
    full_name: user?.full_name || "",
    email: user?.email || "",
    company_id: user?.company_id || companies[0]?.id || 1,
    is_active: user?.is_active ?? true,
    can_view_all_companies: user?.can_view_all_companies ?? true,
    password: ""
  });
  const qc = useQueryClient();

  const createMut = useMutation({
    mutationFn: async () => {
      await api.post("/users", {
        full_name: form.full_name || null,
        email: form.email,
        role: "admin",
        company_id: Number(form.company_id),
        is_active: form.is_active,
        can_view_all_companies: form.can_view_all_companies,
        password: form.password
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admins"] });
      onSaved();
    }
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      const payload: any = {
        full_name: form.full_name || null,
        email: form.email,
        role: "admin",
        company_id: Number(form.company_id),
        is_active: form.is_active,
        can_view_all_companies: form.can_view_all_companies
      };
      if (form.password) payload.password = form.password;
      await api.patch(`/users/${user?.id}`, payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admins"] });
      onSaved();
    }
  });

  const saving = createMut.isPending || updateMut.isPending;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-xl bg-white rounded-lg shadow-xl">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <div className="font-medium">{mode === "create" ? "Nuevo Administrador" : "Editar Administrador"}</div>
            <button className="text-slate-500 hover:text-slate-700" onClick={onClose}>✕</button>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-600">Nombre</span>
                <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-600">Email</span>
                <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-600">Empresa</span>
                <select
                  className="input"
                  value={form.company_id}
                  onChange={(e) => setForm({ ...form, company_id: Number(e.target.value) })}
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-brand-600"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                <span className="text-sm text-slate-700">Activo</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="accent-brand-600"
                  checked={form.can_view_all_companies}
                  onChange={(e) => setForm({ ...form, can_view_all_companies: e.target.checked })}
                />
                <span className="text-sm text-slate-700">Acceso a todas las empresas</span>
              </label>

              <label className="flex flex-col gap-1 md:col-span-2">
                <span className="text-sm text-slate-600">{mode === "create" ? "Contraseña" : "Nueva contraseña (opcional)"}</span>
                <input
                  className="input"
                  type="password"
                  placeholder={mode === "create" ? "Obligatoria" : "Dejar en blanco para mantener"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </label>
            </div>

            <div className="flex items-center gap-3">
              <button
                className="btn inline-flex items-center gap-2"
                disabled={saving}
                onClick={() => (mode === "create" ? createMut.mutate() : updateMut.mutate())}
              >
                {saving && <Loader2 className="animate-spin" size={16} />}
                {mode === "create" ? "Crear Administrador" : "Guardar Cambios"}
              </button>
              <button className="btn-secondary" onClick={onClose}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  description,
  confirmText,
  onConfirm,
  onClose,
  loading
}: {
  title: string;
  description: string;
  confirmText: string;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-lg shadow-xl">
          <div className="px-5 py-4 border-b font-medium">{title}</div>
          <div className="p-5 text-sm text-slate-700">{description}</div>
          <div className="px-5 pb-5 flex items-center gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-md bg-red-50 text-red-600 px-3 py-2 text-sm border border-red-200 hover:bg-red-100"
              onClick={onConfirm}
              disabled={loading}
            >
              {loading && <Loader2 className="animate-spin" size={14} />} {confirmText}
            </button>
            <button className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ViewDialog({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-lg shadow-xl">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <div className="font-medium">{title}</div>
            <button className="text-slate-500 hover:text-slate-700" onClick={onClose}>✕</button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}