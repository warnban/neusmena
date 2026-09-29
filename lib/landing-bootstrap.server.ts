import "server-only";

import { prisma } from "@/lib/prisma";
import { ensurePaymentMethods } from "@/lib/ensure-payment-methods";
import { ensureBookingSources } from "@/lib/ensure-booking-sources";
import { ensureRoomCategories } from "@/lib/ensure-room-categories";
import { canWriteHotelOps } from "@/lib/permissions";

const DEMO_SEAT_ID = "seat-demo";
const DEMO_USER_ID = "u-owner";

/** Публичный снимок demo-сети для превью на лендинге (read-only). */
export async function getLandingBootstrap() {
  const seat = await prisma.seat.findUnique({
    where: { id: DEMO_SEAT_ID },
    select: { id: true, name: true },
  });
  if (!seat) return null;

  const owner = await prisma.user.findUnique({
    where: { id: DEMO_USER_ID },
    select: { id: true, email: true, role: true },
  });
  if (!owner) return null;

  const seatId = seat.id;
  const hotels = await prisma.hotel.findMany({ where: { seatId }, orderBy: { name: "asc" } });
  const hotelIds = hotels.map((h) => h.id);
  const hotelFilter = { seatId, id: { in: hotelIds.length ? hotelIds : ["__none__"] } };

  const [paymentMethods, bookingSources, roomCategories, staff, rooms, beds, guests, organizations, organizationStays, bookings, transactions, catalogItems, hkTasks, channels, hotelDiscountRules, transactionCategories] =
    await Promise.all([
      ensurePaymentMethods(seatId),
      ensureBookingSources(seatId),
      ensureRoomCategories(seatId),
      prisma.staff.findMany({ where: { seatId }, include: { hotels: true } }),
      prisma.room.findMany({ where: { hotel: hotelFilter }, orderBy: [{ floor: "asc" }, { number: "asc" }] }),
      prisma.bed.findMany({ where: { hotel: hotelFilter }, orderBy: [{ roomId: "asc" }, { label: "asc" }] }),
      prisma.guest.findMany({ where: { seatId }, include: { documents: true }, orderBy: { name: "asc" } }),
      prisma.organization.findMany({
        where: { seatId },
        include: { documents: { orderBy: { uploadedAt: "desc" } } },
        orderBy: { name: "asc" },
      }),
      prisma.organizationStay.findMany({
        where: { hotel: hotelFilter },
        include: { rooms: true },
        orderBy: { checkIn: "desc" },
      }),
      prisma.booking.findMany({ where: { hotel: hotelFilter }, orderBy: { checkIn: "asc" } }),
      prisma.transaction.findMany({ where: { hotel: hotelFilter }, orderBy: { date: "desc" } }),
      prisma.service.findMany({ where: { seatId, active: true }, orderBy: [{ kind: "asc" }, { price: "asc" }] }),
      prisma.hkTask.findMany({ where: { hotel: hotelFilter }, orderBy: [{ status: "asc" }, { time: "asc" }] }),
      prisma.channel.findMany({ where: { hotel: hotelFilter }, orderBy: { name: "asc" } }),
      prisma.hotelDiscountRule.findMany({
        where: { hotel: hotelFilter },
        orderBy: [{ minNights: "asc" }, { sortOrder: "asc" }],
      }),
      prisma.transactionCategoryDef.findMany({
        where: { seatId },
        orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
      }),
    ]);

  const staffShaped = staff.map((s) => ({
    id: s.id,
    userId: s.userId,
    name: s.name,
    role: s.role,
    position: s.position,
    initials: s.initials,
    hotelIds: s.hotels.map((h) => h.hotelId),
    hasAccount: Boolean(s.userId),
    dayShiftRate: s.dayShiftRate,
    nightShiftRate: s.nightShiftRate,
    hkShiftRate: s.hkShiftRate,
  }));

  const currentStaff = staffShaped.find((s) => s.userId === owner.id) ?? staffShaped.find((s) => s.role === "owner") ?? null;
  const services = catalogItems.filter((c) => c.kind === "service");
  const expenses = catalogItems.filter((c) => c.kind === "expense");

  return {
    seat,
    session: { userId: owner.id, role: owner.role, email: owner.email },
    hotels,
    staff: staffShaped,
    currentUser: currentStaff,
    rooms,
    beds,
    guests,
    organizations,
    organizationStays,
    bookings,
    transactions,
    services,
    expenses,
    paymentMethods,
    bookingSources,
    roomCategories,
    hkTasks,
    channels,
    hotelDiscountRules,
    transactionCategories,
    canViewAllHotels: true,
    canManageSettings: true,
    canWriteHotelOps: canWriteHotelOps(owner.role),
    defaultHotelId: "h1" as const,
  };
}
