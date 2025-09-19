"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

function humanizeError(err: any): string {
  const detail = err?.response?.data?.detail ?? err?.message ?? "Error";
  // Pydantic v2 can return detail as list of {type,loc,msg,...}
  if (Array.isArray(detail)) {
    const first = detail[0];
    if (first?.msg) return String(first.msg);
    return detail.map((d: any) => d?.msg || JSON.stringify(d)).join(", ");
  }
  if (typeof detail === "object") {
    if (detail.msg) return String(detail.msg);
    try {
      return JSON.stringify(detail);
    } catch {
      return "Error de autenticación";
    }
  }
  return String(detail);
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("superadmin@serviceflow.local");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      if (typeof window !== "undefined") {
        localStorage.setItem("sf_token", data.access_token);
        localStorage.setItem("sf_email", email);
      }
      router.push("/tickets");
    } catch (err: any) {
      setError(humanizeError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center">
      <div className="card w-full max-w-md p-6">
        <h1 className="text-2xl font-semibold mb-2">Iniciar sesión</h1>
        <p className="text-sm text-slate-600 mb-6">Accede a tu cuenta para continuar</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-700">Email</label>
            <input
              className="input mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
          </div>
          <div>
            <label className="text-sm text-slate-700">Contraseña</label>
            <input
              className="input mt-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />
          </div>
          {error && <div className="text-sm text-red-600">{error}</div>}
          <button className="btn w-full" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
        <div className="text-xs text-slate-500 mt-4">
          Demo: superadmin@serviceflow.local / admin123 (semilla automática)
        </div>
      </div>
    </div>
  );
}