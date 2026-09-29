"use client";

import { useEffect } from "react";
import Link from "next/link";
import { crmAppUrl } from "@/lib/host-routing";

/** Свободная регистрация владельца закрыта — только оформление доступа. */
export default function RegisterRedirectPage() {
  useEffect(() => {
    window.location.replace(crmAppUrl("/get-access"));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center max-w-md">
        <p className="text-muted-foreground mb-4">Регистрация владельца доступна только через оформление подписки.</p>
        <Link href={crmAppUrl("/get-access")} className="text-primary font-bold hover:underline">
          Оформить доступ →
        </Link>
      </div>
    </div>
  );
}
