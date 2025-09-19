import axios from "axios";

const apiBase = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api/v1";

export const api = axios.create({
  baseURL: apiBase
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("sf_token");
    if (token) {
      config.headers = config.headers || {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
    const cid = localStorage.getItem("sf_company_id");
    if (cid) {
      config.headers = config.headers || {};
      (config.headers as any)["X-Company-Id"] = cid;
    }
  }
  return config;
});