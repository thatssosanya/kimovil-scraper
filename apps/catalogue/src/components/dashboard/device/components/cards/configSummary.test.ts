import { describe, expect, it } from "vitest";
import {
  buildUniqueConfigSummaries,
  type DeviceConfig,
} from "./configSummary";

const createConfig = (
  overrides: Partial<DeviceConfig> & { id: string }
): DeviceConfig => ({
  id: overrides.id,
  name: overrides.name ?? null,
  capacity: overrides.capacity ?? null,
  ram: overrides.ram ?? null,
  links: overrides.links ?? [],
});

describe("buildUniqueConfigSummaries", () => {
  it("deduplicates configs by normalized capacity and keeps the lowest price", () => {
    const configs: DeviceConfig[] = [
      createConfig({
        id: "1",
        name: "128 ГБ Черный",
        capacity: "128 ГБ",
        links: [{ price: 52000, url: "https://example.com/a" }],
      }),
      createConfig({
        id: "2",
        name: "128 ГБ Серебристый",
        capacity: "128 гб",
        links: [{ price: 48000, url: "https://example.com/b" }],
      }),
    ];

    const summaries = buildUniqueConfigSummaries(configs);

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      name: "128 ГБ Черный",
      price: 48000,
      link: "https://example.com/b",
    });
    expect(summaries[0]?.sortValue).toBe(128);
  });

  it("extracts capacity information from config names when capacity field is missing", () => {
    const configs: DeviceConfig[] = [
      createConfig({
        id: "1",
        name: "Galaxy 256GB Midnight",
        links: [{ price: 61000, url: "https://example.com/a" }],
      }),
      createConfig({
        id: "2",
        name: "Galaxy 256 ГБ Snow",
        links: [{ price: 59000, url: "https://example.com/b" }],
      }),
    ];

    const summaries = buildUniqueConfigSummaries(configs);

    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({
      name: "Galaxy 256GB Midnight",
      price: 59000,
      link: "https://example.com/b",
    });
    expect(summaries[0]?.sortValue).toBe(256);
  });

  it("preserves the original order of unique capacity chips", () => {
    const configs: DeviceConfig[] = [
      createConfig({
        id: "1",
        capacity: "64 ГБ",
      }),
      createConfig({
        id: "2",
        capacity: "128 ГБ",
      }),
      createConfig({
        id: "3",
        name: "64gb Purple Edition",
      }),
    ];

    const summaries = buildUniqueConfigSummaries(configs);

    expect(summaries.map((config) => config.name)).toEqual([
      "64 ГБ",
      "128 ГБ",
    ]);
    expect(summaries[0]?.sortValue).toBe(64);
    expect(summaries[1]?.sortValue).toBe(128);
  });

  it("normalizes TB capacities to GB when computing sort value", () => {
    const configs: DeviceConfig[] = [
      createConfig({
        id: "1",
        capacity: "1 ТБ",
      }),
      createConfig({
        id: "2",
        capacity: "512 ГБ",
      }),
    ];

    const summaries = buildUniqueConfigSummaries(configs);

    const tbConfig = summaries.find((config) => config.name === "1 ТБ");
    const gbConfig = summaries.find((config) => config.name === "512 ГБ");

    expect(tbConfig?.sortValue).toBe(1024);
    expect(gbConfig?.sortValue).toBe(512);
  });
});
