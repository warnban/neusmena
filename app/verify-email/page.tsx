"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, X } from "lucide-react";
import { crmAppUrl } from "@/lib/host-routing";

export default function VerifyEmailPage() {
  const params = useSearchParams();
  const token = params.get("token");
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Ссылка недействительна");
      return;
    }
    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ошибка");
        setStatus("ok");
        setMessage(data.message || "Email подтверждён");
      })
      .catch((e: Error) => {
        setStatus("error");
        setMessage(e.message);
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-card rounded-2xl border border-border p-8 text-center">
        {status === "loading" && <p className="text-muted-foreground">Подтверждение email…</p>}
        {status === "ok" && (
          <>
            <Check size={40} className="text-emerald-500 mx-auto mb-4" />
            <h1 className="text-xl font-black mb-2">Готово</h1>
            <p className="text-muted-foreground mb-6">{message}</p>
            <Link href={crmAppUrl("/login")} className="inline-block px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold">
              Войти в CRM
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <X size={40} className="text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-black mb-2">Не удалось подтвердить</h1>
            <p className="text-muted-foreground mb-6">{message}</p>
            <Link href={crmAppUrl("/login")} className="text-primary font-semibold hover:underline">
              К входу
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
