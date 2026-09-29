"use client";

import { AppDataProvider } from "@/components/providers/app-data";
import { HamsterModeProvider } from "@/components/providers/hamster-mode";
import { AppShell } from "@/components/shell/app-shell";

export default function LandingPreviewShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppDataProvider bootstrapUrl="/api/landing/bootstrap" previewMode defaultHotelId="h1">
      <HamsterModeProvider canUse={false}>
        <AppShell>{children}</AppShell>
      </HamsterModeProvider>
    </AppDataProvider>
  );
}
