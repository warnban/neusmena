import { describe, expect, it } from "vitest";
import {
  contractAfterNightPayment,
  contractAfterReopeningNights,
  contractAfterStayNightDelta,
  unpaidNightTariff,
} from "@/lib/stay-contract";

describe("договор при своей цене ночи", () => {
  const tariff = unpaidNightTariff({
    amount: 13000,
    paid: 0,
    stayNights: 10,
    prepaidNights: 0,
    fallbackTariff: 1300,
  });

  it("неоплаченная ночь стоит тариф, а не среднюю", () => {
    expect(tariff).toBe(1300);
    const afterLess = contractAfterNightPayment({
      amount: 13000,
      nights: 1,
      nightsAmount: 1000,
      tariffPerNight: tariff,
    });
    expect(afterLess).toBe(12700);
    expect(
      unpaidNightTariff({
        amount: afterLess,
        paid: 1000,
        stayNights: 10,
        prepaidNights: 1,
        fallbackTariff: 1300,
      })
    ).toBe(1300);

    const afterMore = contractAfterNightPayment({
      amount: 13000,
      nights: 1,
      nightsAmount: 1500,
      tariffPerNight: tariff,
    });
    expect(afterMore).toBe(13200);
    expect(afterMore - 1500).toBe(11700);
  });

  it("отмена и возврат возвращают ночь к тарифу", () => {
    const amount = contractAfterNightPayment({
      amount: 13000,
      nights: 1,
      nightsAmount: 1000,
      tariffPerNight: 1300,
    });
    expect(
      contractAfterReopeningNights({
        amount,
        releasedAmount: 1000,
        nights: 1,
        tariffPerNight: 1300,
      })
    ).toBe(13000);
  });

  it("продление добавляет ночи по тарифу неоплаченных", () => {
    const amount = contractAfterNightPayment({
      amount: 13000,
      nights: 1,
      nightsAmount: 1000,
      tariffPerNight: 1300,
    });
    expect(contractAfterStayNightDelta(amount, 2, 1300)).toBe(15300);
  });
});
