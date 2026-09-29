"use client";

import { AppDataProvider } from "@/components/providers/app-data";
import { HamsterModeProvider } from "@/components/providers/hamster-mode";

export default function LandingAssistantPreviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppDataProvider bootstrapUrl="/api/landing/bootstrap" previewMode defaultHotelId="h1">
      <HamsterModeProvider canUse initialEnabled persist={false}>
        {children}
      </HamsterModeProvider>
    </AppDataProvider>
  );
}
