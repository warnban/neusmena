"use client";

import { useMemo } from "react";
import { AppDataProvider, useApp } from "@/components/providers/app-data";
import { HamsterModeProvider } from "@/components/providers/hamster-mode";
import { AppShell } from "@/components/shell/app-shell";

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const { canWriteHotelOps, hotels, hotelId } = useApp();
  const hotelAiEnabled = useMemo(() => {
    if (hotelId === "all") return hotels.some((h) => h.aiEnabled);
    return hotels.find((h) => h.id === hotelId)?.aiEnabled ?? false;
  }, [hotels, hotelId]);

  return (
    <HamsterModeProvider canUse={canWriteHotelOps && hotelAiEnabled}>
      <AppShell>{children}</AppShell>
    </HamsterModeProvider>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppDataProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </AppDataProvider>
  );
}
