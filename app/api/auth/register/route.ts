import { NextResponse } from "next/server";

/** Свободная регистрация владельца отключена — доступ через /get-access и панель платформы. */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Свободная регистрация закрыта. Оформите доступ на странице «Подключить отель» — после оплаты учётные данные придут на email.",
    },
    { status: 403 }
  );
}
