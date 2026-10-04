"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get("session") === "expired";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка входа");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-card rounded-2xl border border-border shadow-xl p-8">
        <h1 className="text-xl font-black text-foreground mb-1">Смена</h1>
        <p className="text-sm text-muted-foreground mb-6">Вход в CRM</p>
        {sessionExpired && (
          <p className="text-sm text-amber-600 dark:text-amber-400 mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            Сессия истекла или недействительна. Войдите снова.
          </p>
        )}
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-3 py-2.5 text-sm rounded-xl border border-border bg-muted text-foreground outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">Пароль</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 pr-10 text-sm rounded-xl border border-border bg-muted text-foreground outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={loading} className="w-full py-2.5 text-white text-sm font-bold rounded-xl hover:opacity-90 disabled:opacity-50" style={{ background: "hsl(var(--primary))" }}>
            {loading ? "Вход…" : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}
