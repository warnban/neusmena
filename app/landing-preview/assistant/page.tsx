"use client";

import { HamsterCopilotShell } from "@/components/hamster/hamster-copilot-shell";
import { HamsterModeProvider } from "@/components/providers/hamster-mode";

export default function LandingAssistantPreviewPage() {
  return (
    <HamsterModeProvider canUse initialEnabled>
      <HamsterCopilotShell />
    </HamsterModeProvider>
  );
}
