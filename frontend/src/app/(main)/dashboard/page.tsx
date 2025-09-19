"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Doughnut, Bar, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
} from "chart.js";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

type Overview = {
  kpis: { total: number; open: number; in_progress: number; closed: number; sla: number };
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  resolution_trend: { label: string; avg_hours: number }[];
  tech_performance: Record<string, number>;
};

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["overview"],
    queryFn: async () => {
      const { data } = await api.get<Overview>("/dashboard/overview");
      return data;
    }
  });

  const kpiCard = (title: string, value: string | number, sub?: string) => (
    <div className="card p-4">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );

  if (isLoading || !data) return <div>Cargando...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard de Incidencias</h1>

      <div className="grid md:grid-cols-4 gap-4">
        {kpiCard("Tickets abiertos", data.kpis.open)}
        {kpiCard("En progreso", data.kpis.in_progress)}
        {kpiCard("Resueltos", data.kpis.closed)}
        {kpiCard("Cumplimiento SLA", `${Math.round(data.kpis.sla * 100)}%`, "Objetivo 90%")}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="text-sm text-slate-500 mb-2">Incidencias por Estado</div>
          <Bar
            data={{
              labels: Object.keys(data.by_status),
              datasets: [{ label: "Tickets", data: Object.values(data.by_status), backgroundColor: "#2a86ff" }]
            }}
            options={{ responsive: true, plugins: { legend: { display: false } } }}
          />
        </div>
        <div className="card p-4">
          <div className="text-sm text-slate-500 mb-2">Incidencias por Prioridad</div>
          <Doughnut
            data={{
              labels: Object.keys(data.by_priority),
              datasets: [
                {
                  data: Object.values(data.by_priority),
                  backgroundColor: ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6"]
                }
              ]
            }}
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="text-sm text-slate-500 mb-2">Tiempo Promedio de Resolución</div>
          <Line
            data={{
              labels: data.resolution_trend.map((d) => d.label),
              datasets: [
                {
                  label: "Horas",
                  data: data.resolution_trend.map((d) => d.avg_hours),
                  borderColor: "#2a86ff",
                  backgroundColor: "rgba(42,134,255,0.2)"
                }
              ]
            }}
          />
        </div>
        <div className="card p-4">
          <div className="text-sm text-slate-500 mb-2">Rendimiento de Técnicos (tickets cerrados)</div>
          <Bar
            data={{
              labels: Object.keys(data.tech_performance),
              datasets: [{ label: "Cerrados", data: Object.values(data.tech_performance), backgroundColor: "#22c55e" }]
            }}
            options={{ responsive: true, plugins: { legend: { display: false } } }}
          />
        </div>
      </div>
    </div>
  );
}