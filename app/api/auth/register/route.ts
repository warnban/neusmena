import { NextResponse } from "next/server";

/** Свободная регистрация владельца отключена — владельцев создаёт разработчик в панели платформы. */
export async function POST() {
  return NextResponse.json(
    { error: "Свободная регистрация закрыта. Доступ выдаёт администратор платформы." },
    { status: 403 }
  );
}
