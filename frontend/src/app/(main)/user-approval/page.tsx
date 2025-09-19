"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

type User = {
  id: number;
  email: string;
  full_name?: string | null;
  role: string;
  is_active: boolean;
};

export default function UserApprovalPage() {
  const qc = useQueryClient();
  const users = useQuery({
    queryKey: ["pending-users"],
    queryFn: async () => {
      const { data } = await api.get<User[]>("/users", { params: { active: false } });
      return data;
    },
    refetchInterval: 5000
  });

  const approve = async (id: number) => {
    await api.patch(`/users/${id}`, { is_active: true });
    await qc.invalidateQueries({ queryKey: ["pending-users"] });
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Aprobación de Usuarios</h1>
      <div className="card divide-y">
        <div className="px-4 py-3 text-sm text-slate-500">Pendientes</div>
        <div>
          {users.isLoading && <div className="p-4">Cargando...</div>}
          {!users.isLoading && (users.data?.length ?? 0) === 0 && (
            <div className="p-4 text-sm text-slate-500">No hay usuarios pendientes</div>
          )}
          {users.data?.map((u) => (
            <div key={u.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="font-medium text-sm">{u.full_name || u.email}</div>
                <div className="text-xs text-slate-500">{u.email} · {u.role}</div>
              </div>
              <button className="btn" onClick={() => approve(u.id)}>Aprobar</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}