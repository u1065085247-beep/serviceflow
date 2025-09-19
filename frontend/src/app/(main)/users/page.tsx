"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Eye, Loader2, Pencil, Trash2, UserPlus, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import Link from "next/link";

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

const roleLabel = (r: User["role"]) =>
  r === "superadmin" ? "Superadmin" : r === "admin" ? "Administrador" : r === "tech" ? "Técnico" : "Usuario";

function Avatar({ name }: { name: string }) {
  const initials = useMemo(() => {
    const parts = name.trim().split(" ");
    const a = parts[0]?.[0] || "";
    const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (a + b).toUpperCase();
  }, [name]);
  return <div className="h-10 w-10 rounded-full bg-brand-600 text-white grid place-items-center text-sm font-semibold">{initials || "?"}</div>;
}

export default function UsersPage() {
  const qc = useQueryClient();

  const users = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data } = await api.get<User[]>("/users");
      return data;
    },
    refetchInterval: 30000
  });

  const companies = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data } = await api.get<Company[]>("/companies");
      return data;
    }
  });

  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await api.get<User>("/auth/me");
      return data;
    }
  });

  const [showForm, setShowForm] = useState<null | { mode: "create" | "edit"; user?: User }>(null);
  const [viewUser, setViewUser] = useState<User | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null);

  const toggleActive = useMutation({
    mutationFn: async (u: User) => {
      await api.patch(`/users/${u.id}`, { is_active: !u.is_active });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["users"] });
    }
  });

  const delUser = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/users/${id}`);
    },
    onSuccess: async () => {
      setConfirmDelete(null);
      await qc.invalidateQueries({ queryKey: ["users"] });
    }
  });

  if (users.isLoading) return <div>Cargando usuarios...</div>;

  const grid = users.data || [];
  const canCreateTech = me.data?.role === "admin" || me.data?.role === "superadmin";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Administración de Usuarios</h1>
          <p className="text-sm text-slate-500">Gestiona usuarios por empresa, roles y estado.</p>
        </div>
        <div className="flex items-center gap-2">
          {canCreateTech ? (
            <Link href="/users/create-tech" className="btn inline-flex items-center gap-2">
              <Wrench size={16} /> Nuevo Técnico
            </Link>
          ) : null}
          <button className="btn inline-flex items-center gap-2" onClick={() => setShowForm({ mode: "create" })}>
            <UserPlus size={16} /> Nuevo Usuario
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {grid.map((u) => (
          <div key={u.id} className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar name={u.full_name || u.email} />
                <div>
                  <div className="font-medium">{u.full_name || u.email}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </div>
              </div>
              <span className="text-xs px-2 py-1 rounded-full border">{roleLabel(u.role)}</span>
            </div>

            <div className="rounded-md border px-3 py-2">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">Credenciales</div>
              <div className="text-xs text-slate-700">Usuario: {u.email}</div>
              <div className="text-xs text-slate-700 flex items-center gap-2">
                Contraseña: <span className="tracking-widest">••••••••</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Segura</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Las contraseñas se almacenan con cifrado seguro. Usa la edición para realizar cambios.
              </div>
            </div>

            <div className="text-xs text-slate-600">
              Empresa: {companies.data?.find((c) => c.id === u.company_id)?.name || u.company_id} ·{" "}
              Estado{" "}
              <button
                onClick={() => toggleActive.mutate(u)}
                className={
                  "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border " +
                  (u.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200")
                }
                title="Cambiar estado"
              >
                {u.is_active ? "Activo" : "Inactivo"}
              </button>{" "}
              · {u.role === "tech" ? (u.can_view_all_companies ? "Visión global" : "Solo su empresa") : ""}
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
        <UserForm
          mode={showForm.mode}
          user={showForm.user}
          onClose={() => setShowForm(null)}
          onSaved={async () => {
            setShowForm(null);
            await qc.invalidateQueries({ queryKey: ["users"] });
          }}
        />
      )}

      {viewUser && <UserView user={viewUser} onClose={() => setViewUser(null)} companyName={companies.data?.find(c => c.id===viewUser.company_id)?.name} />}

      {confirmDelete && (
        <ConfirmDialog
          title="Eliminar usuario"
          description={`¿Seguro que deseas eliminar a ${confirmDelete.full_name || confirmDelete.email}? Esta acción no se puede deshacer.`}
          confirmText="Eliminar"
          onClose={() => setConfirmDelete(null)}
          onConfirm={() => delUser.mutate(confirmDelete.id)}
          loading={delUser.isPending}
        />
      )}
    </div>
  );
}

function UserForm({
  mode,
  user,
  onClose,
  onSaved
}: {
  mode: "create" | "edit";
  user?: User;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const qc = useQueryClient();
  const companies = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data } = await api.get<Company[]>("/companies");
      return data;
    }
  });

  const [form, setForm] = useState({
    full_name: user?.full_name || "",
    email: user?.email || "",
    role: (user?.role || "user") as User["role"],
    company_id: user?.company_id || companies.data?.[0]?.id || 1,
    is_active: user?.is_active ?? true,
    can_view_all_companies: user?.can_view_all_companies ?? false,
    password: ""
  });

  const createMut = useMutation({
    mutationFn: async () => {
      await api.post("/users", {
        full_name: form.full_name || null,
        email: form.email,
        role: form.role,
        company_id: Number(form.company_id),
        is_active: form.is_active,
        can_view_all_companies: form.can_view_all_companies,
        password: form.password
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["users"] });
      onSaved();
    }
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      const payload: any = {
        full_name: form.full_name || null,
        email: form.email,
        role: form.role,
        company_id: Number(form.company_id),
        is_active: form.is_active,
        can_view_all_companies: form.can_view_all_companies
      };
      if (form.password) payload.password = form.password;
      await api.patch(`/users/${user?.id}`, payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["users"] });
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
            <div className="font-medium">{mode === "create" ? "Nuevo Usuario" : "Editar Usuario"}</div>
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
                <span className="text-sm text-slate-600">Rol</span>
                <select
                  className="input"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as User["role"] })}
                >
                  <option value="user">Usuario</option>
                  <option value="tech">Técnico</option>
                  <option value="admin">Administrador</option>
                  <option value="superadmin">Superadmin</option>
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-600">Empresa</span>
                <select
                  className="input"
                  value={form.company_id}
                  onChange={(e) => setForm({ ...form, company_id: Number(e.target.value) })}
                >
                  {companies.data?.map((c) => (
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

              {form.role === "tech" || form.role === "admin" ? (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="accent-brand-600"
                    checked={form.can_view_all_companies}
                    onChange={(e) => setForm({ ...form, can_view_all_companies: e.target.checked })}
                  />
                  <span className="text-sm text-slate-700">Puede ver todas las empresas</span>
                </label>
              ) : null}

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
                {mode === "create" ? "Crear Usuario" : "Guardar Cambios"}
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

function UserView({ user, companyName, onClose }: { user: User; companyName?: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-lg shadow-xl">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <div className="font-medium">Detalles del Usuario</div>
            <button className="text-slate-500 hover:text-slate-700" onClick={onClose}>✕</button>
          </div>
          <div className="p-5 space-y-3 text-sm">
            <div className="flex items-center gap-3">
              <Avatar name={user.full_name || user.email} />
              <div>
                <div className="font-medium">{user.full_name || user.email}</div>
                <div className="text-slate-500">{user.email}</div>
              </div>
            </div>
            <div>Rol: <span className="font-medium">{roleLabel(user.role)}</span></div>
            <div>Empresa: <span className="font-medium">{companyName || user.company_id}</span></div>
            <div>Estado: <span className="font-medium">{user.is_active ? "Activo" : "Inactivo"}</span></div>
            {(user.role === "tech" || user.role === "admin") && (
              <div>Alcance: <span className="font-medium">{user.can_view_all_companies ? "Puede ver todas las empresas" : "Solo su empresa"}</span></div>
            )}
            <div className="pt-2 text-xs text-slate-500">Las credenciales se almacenan cifradas. Para cambiar la contraseña, edita el usuario.</div>
            <div className="pt-2">
              <button className="btn-secondary" onClick={onClose}>Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}