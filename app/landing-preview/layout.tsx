export default function LandingPreviewRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="landing-preview-root pointer-events-none select-none overflow-hidden bg-background">{children}</div>;
}
