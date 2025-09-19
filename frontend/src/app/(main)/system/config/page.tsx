"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";

type EmailConfigOut = {
  provider: "smtp" | "mailjet" | "console" | "disabled";
  from_email?: string | null;
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_user?: string | null;
  has_smtp_pass: boolean;
  has_mailjet_keys: boolean;
};

type EmailConfigIn = {
  provider: string;
  from_email?: string | null;
  smtp_host?: string | null;
  smtp_port?: number | null;
  smtp_user?: string | null;
  smtp_pass?: string | null;
  mailjet_api_key?: string | null;
  mailjet_api_secret?: string | null;
};

export default function EmailConfigPage() {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const cfg = useQuery({
    queryKey: ["email-config"],
    queryFn: async () => {
      const { data } = await api.get<EmailConfigOut>("/system/email-config");
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (payload: EmailConfigIn) => {
      const { data } = await api.put<EmailConfigOut>("/system/email-config", payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-config"] });
    },
  });

  const [form, setForm] = useState<EmailConfigIn>({
    provider: "mailjet",
  });

  const [testTo, setTestTo] = useState("");
  const [testSubject, setTestSubject] = useState("Prueba de correo - ServiceFlow");
  const [testBody, setTestBody] = useState("Este es un correo de prueba de ServiceFlow.");
  const [testing, setTesting] = useState(false);

  const onInitForm = (data?: EmailConfigOut) => {
    if (!data) return;
    setForm((f) => ({
      ...f,
      provider: data.provider,
      from_email: data.from_email ?? "",
      smtp_host: data.smtp_host ?? "",
      smtp_port: data.smtp_port ?? undefined,
      smtp_user: data.smtp_user ?? "",
      // no smtp_pass (secreto)
      // no keys (secretos)
    }));
  };

  if (cfg.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-40 bg-slate-200 rounded animate-pulse" />
        <div className="h-40 bg-slate-200 rounded animate-pulse" />
      </div>
    );
  }

  if (cfg.data && !form.from_email && form.provider === "mailjet") {
    onInitForm(cfg.data);
  }

  const handleChange = (field: keyof EmailConfigIn, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await save.mutateAsync(form);
      alert("Configuración guardada");
    } catch (e: any) {
      alert("No se pudo guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  const onTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testTo) {
      alert("Indica un destinatario para la prueba.");
      return;
    }
    setTesting(true);
    try {
      const { data } = await api.post("/system/email/test", {
        to: testTo,
        subject: testSubject,
        body: testBody,
      });
      if (data?.ok) {
        alert("Correo de prueba enviado.");
      } else {
        alert("No se pudo enviar el correo de prueba.");
      }
    } catch (err: any) {
      alert("Error enviando correo de prueba.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Configuración de Email</h1>

      <form onSubmit={onSubmit} className="card p-4 space-y-4 max-w-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-600">Proveedor</span>
            <select
              className="input"
              value={form.provider}
              onChange={(e) => handleChange("provider", e.target.value)}
            >
              <option value="mailjet">Mailjet (recomendado)</option>
              <option value="smtp">SMTP</option>
              <option value="console">Consola (debug)</option>
              <option value="disabled">Deshabilitado</option>
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-600">From Email</span>
            <input
              className="input"
              type="email"
              value={form.from_email || ""}
              onChange={(e) => handleChange("from_email", e.target.value)}
              placeholder="no-reply@tu-dominio.com"
            />
          </label>
        </div>

        {form.provider === "mailjet" && (
          <div className="space-y-3">
            <div className="text-sm font-medium">Mailjet</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-600">API Key</span>
                <input
                  className="input"
                  type="password"
                  onChange={(e) => handleChange("mailjet_api_key", e.target.value)}
                  placeholder={cfg.data?.has_mailjet_keys ? "********" : "tu_api_key"}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-600">API Secret</span>
                <input
                  className="input"
                  type="password"
                  onChange={(e) => handleChange("mailjet_api_secret", e.target.value)}
                  placeholder={cfg.data?.has_mailjet_keys ? "********" : "tu_api_secret"}
                />
              </label>
            </div>
          </div>
        )}

        {form.provider === "smtp" && (
          <div className="space-y-3">
            <div className="text-sm font-medium">SMTP</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-600">Host</span>
                <input
                  className="input"
                  value={form.smtp_host || ""}
                  onChange={(e) => handleChange("smtp_host", e.target.value)}
                  placeholder="smtp.tu-dominio.com"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-600">Puerto</span>
                <input
                  className="input"
                  type="number"
                  value={form.smtp_port || 587}
                  onChange={(e) => handleChange("smtp_port", Number(e.target.value))}
                  placeholder="587"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-600">Usuario</span>
                <input
                  className="input"
                  value={form.smtp_user || ""}
                  onChange={(e) => handleChange("smtp_user", e.target.value)}
                  placeholder="usuario"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-slate-600">Contraseña</span>
                <input
                  className="input"
                  type="password"
                  onChange={(e) => handleChange("smtp_pass", e.target.value)}
                  placeholder={cfg.data?.has_smtp_pass ? "********" : "contraseña"}
                />
              </label>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button disabled={saving} className="btn" type="submit">
            {saving ? "Guardando..." : "Guardar configuración"}
          </button>
          <span className="text-xs text-slate-500">
            Solo superadmin puede modificar estos valores.
          </span>
        </div>
      </form>

      <form onSubmit={onTest} className="card p-4 space-y-4 max-w-2xl">
        <div className="text-sm font-medium">Enviar correo de prueba</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-600">Para (email)</span>
            <input
              className="input"
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="destinatario@correo.com"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-slate-600">Asunto</span>
            <input
              className="input"
              value={testSubject}
              onChange={(e) => setTestSubject(e.target.value)}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-slate-600">Mensaje</span>
          <textarea
            className="input min-h-[100px]"
            value={testBody}
            onChange={(e) => setTestBody(e.target.value)}
          />
        </label>
        <div className="flex items-center gap-3">
          <button disabled={testing} className="btn" type="submit">
            {testing ? "Enviando..." : "Enviar prueba"}
          </button>
          <span className="text-xs text-slate-500">
            Disponible para superadmin y admin.
          </span>
        </div>
      </form>

      <div className="text-xs text-slate-500">
        Notas:
        <ul className="list-disc ml-5 space-y-1 mt-2">
          <li>Mailjet: se usa su API REST (sin SMTP) y es la opción recomendada.</li>
          <li>SMTP: usa STARTTLS si el puerto es 587 o SSL si es 465.</li>
          <li>Consola: imprime los correos en logs (útil para desarrollo).</li>
          <li>Deshabilitado: no se envían correos.</li>
        </ul>
      </div>
    </div>
  );
}