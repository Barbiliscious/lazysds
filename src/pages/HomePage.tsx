import { useEffect, useState } from "react";

type ApiStatus = "checking" | "ok" | "unreachable";

/**
 * Phase 1 placeholder. The real home screen (one big search/scan/upload
 * input) arrives in Phase 2 — for now this page just proves the frontend
 * and the /api function are both deployed and talking.
 */
export default function HomePage() {
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");

  useEffect(() => {
    // Parse the body rather than trusting the status code: the plain Vite
    // dev server answers unknown routes with 200 + index.html, which would
    // otherwise look like a healthy API.
    fetch("/api/health")
      .then((res) => res.json())
      .then((body: unknown) => {
        const isHealthy =
          typeof body === "object" && body !== null && "ok" in body && body.ok === true;
        setApiStatus(isHealthy ? "ok" : "unreachable");
      })
      .catch(() => setApiStatus("unreachable"));
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-4xl font-bold text-slate-800">LazySDS</h1>
      <p className="text-lg text-slate-600 text-center max-w-md">
        Find the safety data sheet for a product and add it to your register —
        no expertise needed.
      </p>

      <div className="rounded-lg bg-white shadow px-6 py-4 text-center">
        <p className="text-sm text-slate-500">Deployment check</p>
        <p className="mt-1 font-medium">
          {apiStatus === "checking" && "Checking the server…"}
          {apiStatus === "ok" && "✅ Frontend and API are both up"}
          {apiStatus === "unreachable" &&
            "⚠️ API not reachable (expected under plain `npm run dev` — use `vercel dev` for full stack)"}
        </p>
      </div>
    </main>
  );
}
