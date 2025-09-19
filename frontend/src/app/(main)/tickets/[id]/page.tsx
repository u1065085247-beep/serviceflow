"use client";

import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRef, useState } from "react";

type Ticket = {
  id: number;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  resolution_summary?: string | null;
  time_spent_minutes?: number | null;
};

type Attachment = {
  id: number;
  filename: string;
  content_type?: string | null;
  url: string;
};

export default function TicketDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const q = useQuery({
    queryKey: ["ticket", id],
    queryFn: async () => {
      const { data } = await api.get<Ticket>(`/tickets/${id}`);
      return data;
    }
  });

  const queryClient = useQueryClient();

  const attachments = useQuery({
    queryKey: ["attachments", id],
    queryFn: async () => {
      const { data } = await api.get<Attachment[]>(`/tickets/${id}/attachments`);
      return data;
    }
  });

  // Upload de adjunto (creador puede subir evidencia; aquí permitimos 1 a la vez)
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    const file = fileInput.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/tickets/${id}/attachments`, fd, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      fileInput.current!.value = "";
      await queryClient.invalidateQueries({ queryKey: ["attachments", id] });
    } finally {
      setUploading(false);
    }
  };

  // Resolver ticket: hh:mm y resumen
  const [hhmm, setHhmm] = useState("");
  const [resolution, setResolution] = useState("");
  const [resolving, setResolving] = useState(false);
  const [newPriority, setNewPriority] = useState<string | "">("");

  const resolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolution || !hhmm) return;
    setResolving(true);
    try {
      await api.post(`/tickets/${id}/resolve`, {
        resolution_summary: resolution,
        time_spent_hhmm: hhmm,
        status: "closed",
        priority: newPriority || undefined
      });
      await queryClient.invalidateQueries({ queryKey: ["ticket", id] });
    } finally {
      setResolving(false);
    }
  };

  const minutesToHHMM = (m?: number | null) => {
    if (!m && m !== 0) return "";
    const hh = Math.floor(m / 60)
      .toString()
      .padStart(2, "0");
    const mm = (m % 60).toString().padStart(2, "0");
    return `${hh}:${mm}`;
  };

  return (
    <div className="space-y-6">
      {q.isLoading ? (
        <div>Cargando...</div>
      ) : q.data ? (
        <>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold">{q.data.title}</h1>
              <div className="text-sm text-slate-600">
                {q.data.status} · {q.data.priority} ·{" "}
                {new Date(q.data.created_at).toLocaleString()}
              </div>
              {q.data.resolved_at && (
                <div className="text-xs text-slate-500">
                  Resuelto: {new Date(q.data.resolved_at).toLocaleString()} · Tiempo:{" "}
                  {minutesToHHMM(q.data.time_spent_minutes ?? 0)}
                </div>
              )}
            </div>
          </div>

          {q.data.description && (
            <div className="card p-4">
              <div className="text-sm whitespace-pre-wrap">{q.data.description}</div>
            </div>
          )}

          {/* Adjuntos (evidencias) */}
          <div className="card p-4 space-y-3">
            <div className="font-medium">Adjuntos</div>
            <form onSubmit={upload} className="flex items-center gap-3">
              <input ref={fileInput} className="input" type="file" />
              <button className="btn" disabled={uploading}>
                {uploading ? "Subiendo..." : "Subir archivo"}
              </button>
            </form>
            <div className="divide-y">
              {attachments.isLoading && <div className="py-2 text-sm">Cargando adjuntos...</div>}
              {!attachments.isLoading && attachments.data?.length === 0 && (
                <div className="py-2 text-sm text-slate-500">Sin adjuntos</div>
              )}
              {attachments.data?.map((a) => (
                <a
                  key={a.id}
                  href={a.url}
                  target="_blank"
                  className="flex items-center justify-between py-2 text-sm hover:underline"
                >
                  <span>{a.filename}</span>
                  <span className="text-brand-700">Descargar</span>
                </a>
              ))}
            </div>
          </div>

          {/* Resolver ticket */}
          {q.data.status !== "closed" && (
            <div className="card p-4 space-y-4">
              <div className="font-medium">Resolver incidencia</div>
              <form onSubmit={resolve} className="space-y-3">
                <div>
                  <label className="text-sm text-slate-700">Resumen de resolución</label>
                  <textarea
                    className="input mt-1 min-h-[100px]"
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    placeholder="Describe la solución aplicada"
                  />
                </div>
                <div className="grid md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm text-slate-700">Tiempo invertido (HH:MM)</label>
                    <input
                      className="input mt-1"
                      value={hhmm}
                      onChange={(e) => setHhmm(e.target.value)}
                      placeholder="00:30"
                      pattern="^\\d{1,2}:\\d{2}$"
                      title="Formato HH:MM"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-slate-700">Actualizar prioridad (opcional)</label>
                    <select
                      className="input mt-1"
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value as any)}
                    >
                      <option value="">Sin cambios</option>
                      <option value="low">Baja</option>
                      <option value="normal">Media</option>
                      <option value="high">Alta</option>
                      <option value="urgent">Urgente</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button className="btn" disabled={!resolution || !hhmm || resolving}>
                    {resolving ? "Resolviendo..." : "Marcar como Resuelto"}
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      ) : (
        <div>No encontrado</div>
      )}
    </div>
  );
}