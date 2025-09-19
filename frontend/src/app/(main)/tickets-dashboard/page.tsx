"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMemo, useState } from "react";
import Link from "next/link";

type TechItem = {
  user_id: number;
  name: string;
  resolved: number;
  total: number;
  percent: number;
};

type Stats = {
  period: "week" | "month" | "year";
  since: string;
  techs: TechItem[];
  urgent_unassigned: number;
  pending_approvals: number;
  hardware: { total: number; open: number; closed: number };
  now: string;
};

function Avatar({ name }: { name: string }) {
  const initials = useMemo(() => {
    const parts = name.split(" ").filter(Boolean);
    const a = parts[0]?.[0] || "";
    const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (a + b).toUpperCase();
  }, [name]);
  return (
    <div className="h-8 w-8 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs">
      {initials || "?"}
    </div>
  );
}

export default function TicketsDashboardPage() {
  const [period, setPeriod] = useState<"week" | "month" | "year">("week");

  const stats = useQuery({
    queryKey: ["stats-tickets", period],
    queryFn: async () => {
      const { data } = await api.get<Stats>("/stats/tickets", { params: { period } });
      return data;
    },
    refetchInterval: 5000
  });

  const Skeleton = () => (
    <div className="animate-pulse space-y-3">
      <div className="h-6 bg-slate-200 rounded w-40" />
      <div className="h-24 bg-slate-200 rounded" />
      <div className="h-24 bg-slate-200 rounded" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard de Incidencias</h1>
        <select
          className="input w-40"
          value={period}
          onChange={(e) => setPeriod(e.target.value as any)}
        >
          <option value="week">Última semana</option>
          <option value="month">Último mes</option>
          <option value="year">Último año</option>
        </select>
      </div>

      {/* Notificaciones */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Usuarios pendientes de aprobación */}
        <div className="card p-4">
          <div className="text-sm text-slate-500">Usuarios pendientes</div>
          {stats.isLoading ? (
            <div className="h-6 w-16 bg-slate-200 rounded animate-pulse mt-2" />
          ) : (
            <div className="text-2xl font-semibold">{stats.data?.pending_approvals ?? 0}</div>
          )}
          <Link href="/user-approval" className="text-brand-700 text-sm mt-2 inline-block">
            Ir a aprobación
          </Link>
        </div>

        {/* Urgentes sin asignar */}
        <div className="card p-4">
          <div className="text-sm text-slate-500">Urgentes sin asignar</div>
          {stats.isLoading ? (
            <div className="h-6 w-16 bg-slate-200 rounded animate-pulse mt-2" />
          ) : (
            <div className="text-2xl font-semibold">
              {stats.data?.urgent_unassigned ?? 0}
            </div>
          )}
          <Link href="/tickets" className="text-sm text-red-600 mt-2 inline-block">
            Ver tickets
          </Link>
        </div>

        {/* Hardware */}
        <div className="card p-4">
          <div className="text-sm text-slate-500">Tickets de Hardware</div>
          {stats.isLoading ? (
            <div className="h-6 w-20 bg-slate-200 rounded animate-pulse mt-2" />
          ) : (
            <div className="text-2xl font-semibold">
              {stats.data?.hardware.total ?? 0}
              <span className="text-sm text-slate-500 ml-2">
                ({stats.data?.hardware.open ?? 0} abiertos)
              </span>
            </div>
          )}
          <Link href="/tickets?q=hardware" className="text-sm text-brand-700 mt-2 inline-block">
            Ver hardware
          </Link>
        </div>
      </div>

      {/* Rendimiento por técnico */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div className="font-medium">Rendimiento por técnico</div>
          <div className="text-xs text-slate-500">
            {stats.isLoading ? "Cargando..." : `Desde ${stats.data?.since ? new Date(stats.data.since).toLocaleString() : ""}`}
          </div>
        </div>

        {stats.isLoading ? (
          <div className="mt-4">
            <Skeleton />
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {stats.data?.techs.length ? (
              stats.data.techs.map((t) => (
                <div key={t.user_id} className="flex items-center gap-3">
                  <Avatar name={t.name} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="font-medium">{t.name}</div>
                      <div className="text-slate-600">
                        {t.resolved}/{t.total} · {t.percent}%
                      </div>
                    </div>
                    <div className="h-2 bg-slate-200 rounded mt-2 overflow-hidden">
                      <div
                        className="h-2 bg-brand-600"
                        style={{ width: `${Math.min(100, t.percent)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-500">Sin datos para el período seleccionado</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}