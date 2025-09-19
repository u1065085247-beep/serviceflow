"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { X, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Ticket = {
  id: number;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  assignee_id: number | null;
  requester_id: number;
  company_id: number;
};

type User = {
  id: number;
  full_name?: string | null;
  email: string;
  role: string;
};

type Company = {
  id: number;
  name: string;
};

type Comment = {
  id: number;
  user_id: number;
  body: string;
  is_public: boolean;
  created_at: string;
};

type Worklog = {
  id: number;
  user_id: number;
  started_at: string;
  ended_at?: string | null;
};

export default function MyTicketsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();

  // Usuario actual
  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await api.get<User>("/auth/me");
      return data;
    }
  });

  const isStaff = (me.data?.role && ["tech", "admin", "superadmin"].includes(me.data.role)) || false;

  // Listado de tickets (filtrado por requester_id en cliente; si backend soporta filtro, se podría pasar params)
  const tickets = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => {
      const { data } = await api.get<Ticket[]>("/tickets");
      return data;
    },
    enabled: !!me.data
  });

  // Usuarios (para mostrar nombres y email del técnico / creador)
  const users = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data } = await api.get<User[]>("/users");
      return data;
    }
  });

  // Empresas (para mostrar nombre)
  const companies = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data } = await api.get<Company[]>("/companies");
      return data;
    }
  });

  const myTickets = useMemo(() => {
    if (!tickets.data || !me.data) return [];
    return tickets.data.filter((t) => t.requester_id === me.data!.id);
  }, [tickets.data, me.data]);

  // Helpers
  const requesterOf = (reqId: number) => users.data?.find((u) => u.id === reqId);
  const userOf = (id: number | null) => (id ? users.data?.find((u) => u.id === id) : undefined);
  const companyOf = (cid: number) => companies.data?.find((c) => c.id === cid);

  const Badge = ({ children, color = "slate" }: { children: any; color?: "slate" | "green" | "yellow" | "red" | "blue" }) => {
    const map: Record<string, string> = {
      slate: "bg-slate-100 text-slate-700",
      green: "bg-green-100 text-green-700",
      yellow: "bg-yellow-100 text-yellow-800",
      red: "bg-red-100 text-red-700",
      blue: "bg-blue-100 text-blue-700"
    };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${map[color]}`}>{children}</span>;
  };

  const statusBadgeColor = (s: string): "blue" | "yellow" | "green" | "red" | "slate" => {
    if (s === "open") return "blue";
    if (s === "in_progress") return "yellow";
    if (s === "closed") return "green";
    return "slate";
  };

  // Modal de detalle
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedTicket = useQuery({
    queryKey: ["ticket", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data } = await api.get<Ticket>(`/tickets/${selectedId}`);
      return data;
    }
  });

  // Comentarios del ticket seleccionado
  const comments = useQuery({
    queryKey: ["comments", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data } = await api.get<Comment[]>(`/tickets/${selectedId}/comments`);
      return data;
    }
  });

  // Worklogs (solo útiles para staff; si no, no mostramos control de tiempo)
  const worklogs = useQuery({
    queryKey: ["worklogs", selectedId],
    enabled: !!selectedId && isStaff,
    queryFn: async () => {
      const { data } = await api.get<Worklog[]>(`/tickets/${selectedId}/worklogs`);
      return data;
    }
  });

  const closeModal = () => setSelectedId(null);

  const desasignar = async (id: number) => {
    if (!isStaff) return;
    await api.patch(`/tickets/${id}`, { assignee_id: null });
    await queryClient.invalidateQueries({ queryKey: ["tickets"] });
    await queryClient.invalidateQueries({ queryKey: ["ticket", id] });
  };

  // Cálculo de tiempo (solo si staff; si no, no mostramos el bloque)
  const [nowTick, setNowTick] = useState<number>(Date.now());
  useEffect(() => {
    if (!selectedId || !isStaff) return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [selectedId, isStaff]);

  const minutesWorked = useMemo(() => {
    if (!isStaff || !worklogs.data) return 0;
    let totalMs = 0;
    for (const wl of worklogs.data) {
      const start = new Date(wl.started_at).getTime();
      const end = wl.ended_at ? new Date(wl.ended_at).getTime() : nowTick;
      totalMs += Math.max(0, end - start);
    }
    return Math.floor(totalMs / 60000);
  }, [worklogs.data, nowTick, isStaff]);

  const hhmm = (m: number) => {
    const hh = Math.floor(m / 60).toString().padStart(2, "0");
    const mm = (m % 60).toString().padStart(2, "0");
    return `${hh}:${mm}`;
  };

  const hasActiveWork = useMemo(() => {
    if (!isStaff) return false;
    return (worklogs.data || []).some((w) => !w.ended_at);
  }, [worklogs.data, isStaff]);

  const startWork = async () => {
    if (!selectedId || !isStaff) return;
    try {
      await api.post(`/tickets/${selectedId}/worklogs/start`);
      await queryClient.invalidateQueries({ queryKey: ["worklogs", selectedId] });
    } catch {}
  };

  const stopWork = async () => {
    if (!selectedId || !isStaff) return;
    try {
      await api.post(`/tickets/${selectedId}/worklogs/stop`);
      await queryClient.invalidateQueries({ queryKey: ["worklogs", selectedId] });
    } catch {}
  };

  // Comentarios: envío
  const [commentBody, setCommentBody] = useState("");
  const [commentPublic, setCommentPublic] = useState(true);
  const submitComment = async () => {
    if (!selectedId || !commentBody.trim()) return;
    await api.post(`/tickets/${selectedId}/comments`, {
      body: commentBody.trim(),
      is_public: commentPublic
    });
    setCommentBody("");
    await queryClient.invalidateQueries({ queryKey: ["comments", selectedId] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Mis Tickets</h1>
        <Link className="btn" href="/tickets/create">
          <Plus size={16} />
          Crear Ticket
        </Link>
      </div>

      <div className="card divide-y">
        <div className="px-4 py-3 text-sm text-slate-500">Listado de mis tickets</div>
        <div>
          {(tickets.isLoading || me.isLoading) && <div className="p-4">Cargando...</div>}
          {!tickets.isLoading && !me.isLoading && myTickets.length === 0 && (
            <div className="p-4">No tienes tickets aún.</div>
          )}
          {!tickets.isLoading &&
            !me.isLoading &&
            myTickets.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                <div className="flex-1">
                  <div className="font-medium">{t.title}</div>
                  <div className="text-xs text-slate-500">
                    {t.status} · {t.priority} · {new Date(t.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-slate-600">
                    Técnico: {userOf(t.assignee_id)?.full_name || userOf(t.assignee_id)?.email || "Sin asignar"}
                  </div>
                  <button onClick={() => setSelectedId(t.id)} className="text-sm text-brand-700">
                    Ver
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Modal de detalle */}
      {selectedId && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-3xl bg-white rounded-lg shadow-xl relative">
              <button
                className="absolute top-3 right-3 text-slate-500 hover:text-slate-700"
                onClick={closeModal}
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>

              {selectedTicket.isLoading || !selectedTicket.data ? (
                <div className="p-6">Cargando...</div>
              ) : (
                <div className="p-6 space-y-6">
                  {/* Cabecera */}
                  <div className="text-sm text-slate-500">
                    Ticket #{selectedTicket.data.id}{" "}
                    <span className="font-semibold text-slate-800">{selectedTicket.data.title}</span>
                  </div>

                  {/* Resumen */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="text-xs text-slate-500">Estado</div>
                      <Badge color={statusBadgeColor(selectedTicket.data.status)}>
                        {selectedTicket.data.status === "open"
                          ? "Abierto"
                          : selectedTicket.data.status === "in_progress"
                          ? "En Progreso"
                          : "Resuelto"}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-slate-500">Prioridad</div>
                      <Badge
                        color={
                          selectedTicket.data.priority === "urgent"
                            ? "red"
                            : selectedTicket.data.priority === "high"
                            ? "yellow"
                            : "slate"
                        }
                      >
                        {selectedTicket.data.priority === "urgent"
                          ? "Urgente"
                          : selectedTicket.data.priority === "high"
                          ? "Alta"
                          : selectedTicket.data.priority === "normal"
                          ? "Media"
                          : "Baja"}
                      </Badge>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Empresa</div>
                      <div className="text-sm">{companyOf(selectedTicket.data.company_id)?.name ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Creado por</div>
                      <div className="text-sm">
                        {requesterOf(selectedTicket.data.requester_id)?.full_name ??
                          requesterOf(selectedTicket.data.requester_id)?.email ??
                          "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Contacto</div>
                      <div className="text-sm">{requesterOf(selectedTicket.data.requester_id)?.email ?? "—"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Fecha de creación</div>
                      <div className="text-sm">{new Date(selectedTicket.data.created_at).toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Última actualización</div>
                      <div className="text-sm">
                        {selectedTicket.data.updated_at
                          ? new Date(selectedTicket.data.updated_at).toLocaleString()
                          : "Sin actualizar"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">Técnico asignado</div>
                      {isStaff ? (
                        <div className="flex items-center gap-2">
                          <select
                            className="input"
                            value={selectedTicket.data.assignee_id ?? ""}
                            onChange={async (e) => {
                              const v = e.target.value ? Number(e.target.value) : null;
                              await api.patch(`/tickets/${selectedId}`, { assignee_id: v });
                              await queryClient.invalidateQueries({ queryKey: ["tickets"] });
                              await queryClient.invalidateQueries({ queryKey: ["ticket", selectedId] });
                            }}
                          >
                            <option value="">Sin asignar</option>
                            {users.data?.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.full_name || u.email}
                              </option>
                            ))}
                          </select>
                          <button className="text-sm text-slate-600 hover:text-slate-800" onClick={() => desasignar(selectedTicket.data.id)}>
                            Desasignar
                          </button>
                        </div>
                      ) : (
                        <div className="text-sm">
                          {userOf(selectedTicket.data.assignee_id)?.full_name ||
                            userOf(selectedTicket.data.assignee_id)?.email ||
                            "Sin asignar"}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Descripción */}
                  {selectedTicket.data.description && (
                    <div className="space-y-1">
                      <div className="text-sm text-slate-700">Descripción</div>
                      <div className="card p-4 text-sm whitespace-pre-wrap">{selectedTicket.data.description}</div>
                    </div>
                  )}

                  {/* Control de tiempo (solo staff) */}
                  {isStaff && (
                    <div className="card p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">Control de Tiempo</div>
                        <Badge color={statusBadgeColor(selectedTicket.data.status)}>
                          {selectedTicket.data.status === "open"
                            ? "Abierto"
                            : selectedTicket.data.status === "in_progress"
                            ? "En Progreso"
                            : "Resuelto"}
                        </Badge>
                      </div>
                      <div className="text-sm text-slate-600">Gestiona el tiempo de trabajo en este ticket</div>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-600">Tiempo trabajado:</span>
                          <span className="font-medium">{hhmm(minutesWorked)}</span>
                        </div>
                        {hasActiveWork ? (
                          <button className="btn btn-secondary" onClick={stopWork}>
                            Detener Trabajo
                          </button>
                        ) : (
                          <button className="btn btn-secondary" onClick={startWork}>
                            Iniciar Trabajo
                          </button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="btn"
                          onClick={() => {
                            const url = process.env.NEXT_PUBLIC_REMOTE_SUPPORT_URL || "#";
                            if (url === "#") return;
                            window.open(url, "_blank");
                          }}
                        >
                          Soporte Remoto
                        </button>
                        <button className="btn" onClick={() => router.push(`/tickets/${selectedId}`)}>
                          Marcar como Resuelto
                        </button>
                        <button className="btn btn-secondary" onClick={() => alert("Edición de ticket pendiente")}>
                          Editar Ticket
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Comentarios */}
                  <div className="space-y-3">
                    <div className="font-medium">Comentarios del Ticket</div>
                    <div className="divide-y rounded-md border">
                      {comments.isLoading && <div className="p-3 text-sm text-slate-500">Cargando comentarios...</div>}
                      {!comments.isLoading && (comments.data?.length ?? 0) === 0 && (
                        <div className="p-3 text-sm text-slate-500">No hay comentarios en este ticket todavía.</div>
                      )}
                      {comments.data?.map((c) => {
                        const u = users.data?.find((x) => x.id === c.user_id);
                        return (
                          <div key={c.id} className="px-3 py-2 text-sm flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <div className="text-slate-700">
                                {u?.full_name || u?.email || "Usuario"} ·{" "}
                                <span className="text-slate-500">{new Date(c.created_at).toLocaleString()}</span>
                              </div>
                              {!c.is_public && <Badge color="slate">Privado</Badge>}
                            </div>
                            <div className="text-slate-800 whitespace-pre-wrap">{c.body}</div>
                          </div>
                        );
                      })}
                    </div>
                    <div>
                      <textarea
                        className="input min-h-[90px]"
                        placeholder="Escribe un comentario..."
                        value={commentBody}
                        onChange={(e) => setCommentBody(e.target.value)}
                      />
                      <div className="mt-2 flex items-center justify-between text-sm">
                        <label className="inline-flex items-center gap-2 text-slate-600">
                          <input
                            type="checkbox"
                            className="accent-brand-600"
                            checked={commentPublic}
                            onChange={(e) => setCommentPublic(e.target.checked)}
                            disabled={!isStaff}
                          />
                          Comentario público (visible para todos){!isStaff ? " (obligatorio)" : ""}
                        </label>
                        <button className="btn" onClick={submitComment} disabled={!commentBody.trim()}>
                          Enviar Comentario
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
