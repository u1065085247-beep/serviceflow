"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";

export default function CreateTicketPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDesc] = useState("");
  const [status, setStatus] = useState("open");
  const [priority, setPriority] = useState("normal");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onDrop = (accepted: File[]) => {
    setFile(accepted[0] || null);
  };
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, multiple: false, maxFiles: 1 });

  const create = async () => {
    setSubmitting(true);
    try {
      const { data } = await api.post("/tickets", { title, description, status, priority });
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        await api.post(`/tickets/${data.id}/attachments`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      }
      router.push(`/tickets/${data.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Crear Nuevo Ticket</h1>

      <div className="card p-6 space-y-4 max-w-3xl">
        <div>
          <label className="text-sm text-slate-700">Título</label>
          <input className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="text-sm text-slate-700">Descripción</label>
          <textarea className="input mt-1 min-h-[120px]" value={description} onChange={(e) => setDesc(e.target.value)} />
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-slate-700">Estado</label>
            <select className="input mt-1" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="open">Abierto</option>
              <option value="in_progress">En Progreso</option>
              <option value="closed">Resuelto</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-700">Prioridad</label>
            <select className="input mt-1" value={priority} onChange={(e) => setPriority(e.target.value)}>
              <option value="low">Baja</option>
              <option value="normal">Media</option>
              <option value="high">Alta</option>
              <option value="urgent">Urgente</option>
            </select>
          </div>
        </div>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-md px-4 py-10 text-center ${
            isDragActive ? "border-brand-500 bg-brand-50" : "border-slate-300"
          }`}
        >
          <input {...getInputProps()} />
          <div className="text-sm text-slate-600">
            {file ? (
              <>Archivo seleccionado: {file.name}</>
            ) : (
              <>Clic para seleccionar o arrastra y suelta (máx. 10MB). Solo 1 archivo.</>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button className="btn" onClick={create} disabled={!title || submitting}>
            {submitting ? "Creando..." : "Crear Ticket"}
          </button>
        </div>
      </div>
    </div>
  );
}