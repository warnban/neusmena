import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Смена — операционная система для гостиниц",
  description:
    "CRM для гостиниц и хостелов: бронирования, заселение, касса, миграционный учёт. Неограниченное число отелей за 5 000 ₽/мес. AI Premium — распознавание паспортов и помощник администратора.",
  openGraph: {
    title: "Смена — CRM для гостиниц",
    description: "Вся сеть отелей в одном аккаунте. 5 000 ₽/мес без доплат за объекты.",
    type: "website",
  },
};

export default function Page() {
  return <LandingPage />;
}
