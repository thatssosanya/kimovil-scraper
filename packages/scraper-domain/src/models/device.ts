import { Schema } from "@effect/schema";

export type DataKind = "specs" | "prices" | "reviews" | "availability";
export type SourceStatus = "active" | "missing" | "deleted" | "conflict";
export type ScrapeStatus = "pending" | "running" | "done" | "error";

export class Device extends Schema.Class<Device>("Device")({
  id: Schema.String,
  slug: Schema.String,
  name: Schema.String,
  brand: Schema.NullOr(Schema.String),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
}) {}

export class DeviceSourceLink extends Schema.Class<DeviceSourceLink>("DeviceSourceLink")({
  deviceId: Schema.String,
  source: Schema.String,
  externalId: Schema.String,
  url: Schema.NullOr(Schema.String),
  status: Schema.Literal("active", "missing", "deleted", "conflict"),
  firstSeen: Schema.Number,
  lastSeen: Schema.Number,
}) {}

export class Scrape extends Schema.Class<Scrape>("Scrape")({
  id: Schema.Number,
  deviceId: Schema.NullOr(Schema.String),
  source: Schema.String,
  dataKind: Schema.String,
  externalId: Schema.String,
  url: Schema.NullOr(Schema.String),
  requestedAt: Schema.Number,
  startedAt: Schema.NullOr(Schema.Number),
  completedAt: Schema.NullOr(Schema.Number),
  status: Schema.Literal("pending", "running", "done", "error"),
  errorMessage: Schema.NullOr(Schema.String),
}) {}

export type DeviceData = typeof Device.Type;
export type DeviceSourceLinkData = typeof DeviceSourceLink.Type;
export type ScrapeData = typeof Scrape.Type;
