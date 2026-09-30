export function crmAppUrl(path = "/dashboard"): string {
  const base = process.env.NEXT_PUBLIC_CRM_URL ?? "";
  if (base) return `${base.replace(/\/$/, "")}${path}`;
  return path;
}
