import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  uniqueIndex,
  index,
  customType,
} from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

// Custom datetime type that handles ISO string storage with timezone
export const datetimeNow = sql`(strftime('%Y-%m-%dT%H:%M:%f', 'now', 'localtime') || '+00:00')`;

export const datetime = customType<{ data: Date; driverData: string }>({
  dataType() {
    return "text";
  },
  toDriver(value: Date): string {
    return value.toISOString();
  },
  fromDriver(value: string): Date {
    return new Date(value);
  },
});

// Example model
export const example = sqliteTable("Example", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  createdAt: datetime("createdAt")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: datetime("updatedAt")
    .notNull()
    .$defaultFn(() => new Date()),
});

// Marketplace model
export const marketplace = sqliteTable("Marketplace", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  createdAt: datetime("createdAt")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: datetime("updatedAt")
    .notNull()
    .$defaultFn(() => new Date()),
  iconUrl: text("iconUrl"),
  baseUrl: text("baseUrl"),
});

// AliExpressItem model
export const aliExpressItem = sqliteTable(
  "AliExpressItem",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    url: text("url").notNull().unique(),
    name: text("name"),
    commissionRate: text("commissionRate"),
    imageUrl: text("imageUrl"),
    createdAt: datetime("createdAt")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime("updatedAt")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    urlIdx: uniqueIndex("AliExpressItem_url_key").on(table.url),
  })
);

// NextAuth models
export const account = sqliteTable(
  "Account",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId").notNull(),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => ({
    providerProviderAccountIdIdx: uniqueIndex(
      "Account_provider_providerAccountId_key"
    ).on(table.provider, table.providerAccountId),
    userIdIdx: index("Account_userId_idx").on(table.userId),
  })
);

export const session = sqliteTable(
  "Session",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    sessionToken: text("sessionToken").notNull().unique(),
    userId: text("userId").notNull(),
    expires: text("expires").notNull(),
  },
  (table) => ({
    userIdIdx: index("Session_userId_idx").on(table.userId),
  })
);

export const user = sqliteTable("User", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: text("emailVerified"),
  image: text("image"),
});

export const verificationToken = sqliteTable(
  "VerificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull().unique(),
    expires: text("expires").notNull(),
  },
  (table) => ({
    identifierTokenIdx: uniqueIndex(
      "VerificationToken_identifier_token_key"
    ).on(table.identifier, table.token),
  })
);

// Widget and related models
export const widgetType = sqliteTable("WidgetType", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  type: text("type"),
});

export const category = sqliteTable("Category", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  wordpressId: text("wordpressId").notNull(),
  name: text("name"),
  createdAt: datetime("createdAt")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: datetime("updatedAt")
    .notNull()
    .$defaultFn(() => new Date()),
});

export const tag = sqliteTable("Tag", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  wordpressId: text("wordpressId").notNull(),
  name: text("name"),
  createdAt: datetime("createdAt")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: datetime("updatedAt")
    .notNull()
    .$defaultFn(() => new Date()),
});

export const widget = sqliteTable(
  "Widget",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name"),
    widgetTypeId: text("widgetTypeId"),
    createdAt: datetime("createdAt")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime("updatedAt")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    widgetTypeIdIdx: index("Widget_widgetTypeId_idx").on(table.widgetTypeId),
  })
);

// Device model
export const device = sqliteTable(
  "Device",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name"),
    type: text("type"),
    imageUrl: text("imageUrl"),
    createdAt: datetime("createdAt")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime("updatedAt")
      .notNull()
      .$defaultFn(() => new Date()),
    yandexId: text("yandexId"),
    widgetId: text("widgetId"),
    description: text("description"),
    valueRating: integer("valueRating"),
    availabilityStatus: text("availabilityStatus", {
      enum: ["selling", "not_in_sale", "not_yet_in_sale"],
    })
      .notNull()
      .default("selling"),
    normalizedName: text("normalizedName"),
    duplicateStatus: text("duplicateStatus", {
      enum: ["unique", "potential", "duplicate"],
    })
      .notNull()
      .default("unique"),
    duplicateOfId: text("duplicateOfId"),
  },
  (table) => ({
    widgetIdIdx: index("Device_widgetId_idx").on(table.widgetId),
    availabilityStatusIdx: index("Device_availabilityStatus_idx").on(
      table.availabilityStatus
    ),
    normalizedNameIdx: index("Device_normalizedName_idx").on(
      table.normalizedName
    ),
    duplicateOfIdIdx: index("Device_duplicateOfId_idx").on(table.duplicateOfId),
  })
);

// Rating models
export const ratingCategory = sqliteTable("RatingCategory", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  createdAt: datetime("createdAt")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: datetime("updatedAt")
    .notNull()
    .$defaultFn(() => new Date()),
});

export const ratingType = sqliteTable("RatingType", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  displayName: text("displayName"),
  description: text("description"),
  createdAt: datetime("createdAt")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: datetime("updatedAt")
    .notNull()
    .$defaultFn(() => new Date()),
});

export const rating = sqliteTable(
  "Rating",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    ratingTypeId: text("ratingTypeId").notNull(),
    status: text("status").notNull().default("DRAFT"),
    publishedAt: datetime("publishedAt"),
    createdAt: datetime("createdAt")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime("updatedAt")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    ratingTypeIdIdx: index("Rating_ratingTypeId_idx").on(table.ratingTypeId),
    ratingTypeIdCreatedAtIdx: index("Rating_ratingTypeId_createdAt_idx").on(
      table.ratingTypeId,
      table.createdAt
    ),
    statusIdx: index("Rating_status_idx").on(table.status),
    slugIdx: index("Rating_slug_idx").on(table.slug),
    slugStatusIdx: index("Rating_slug_status_idx").on(table.slug, table.status),
  })
);

export const ratingPosition = sqliteTable(
  "RatingPosition",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    customDescription: text("customDescription"),
    deviceId: text("deviceId").notNull(),
    ratingId: text("ratingId").notNull(),
    position: integer("position").notNull(),
    createdAt: datetime("createdAt")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime("updatedAt")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    ratingIdDeviceIdIdx: uniqueIndex("RatingPosition_ratingId_deviceId_key").on(
      table.ratingId,
      table.deviceId
    ),
    ratingIdPositionIdx: uniqueIndex("RatingPosition_ratingId_position_key").on(
      table.ratingId,
      table.position
    ),
    deviceIdIdx: index("RatingPosition_deviceId_idx").on(table.deviceId),
    ratingIdIdx: index("RatingPosition_ratingId_idx").on(table.ratingId),
    positionRatingIdIdx: index("RatingPosition_position_ratingId_idx").on(
      table.position,
      table.ratingId
    ),
  })
);

// Config model
export const config = sqliteTable("Config", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull().unique(),
  capacity: text("capacity"),
  ram: text("ram"),
  createdAt: datetime("createdAt")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: datetime("updatedAt")
    .notNull()
    .$defaultFn(() => new Date()),
});

// Link model
export const link = sqliteTable(
  "Link",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name"),
    url: text("url"),
    createdAt: datetime("createdAt")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime("updatedAt")
      .notNull()
      .$defaultFn(() => new Date()),
    price: integer("price").notNull(),
    deviceId: text("deviceId"),
    marketplaceId: text("marketplaceId"),
    configId: text("configId"),
    skuId: text("skuId"),
  },
  (table) => ({
    deviceIdIdx: index("Link_deviceId_idx").on(table.deviceId),
    marketplaceIdIdx: index("Link_marketplaceId_idx").on(table.marketplaceId),
    configIdIdx: index("Link_configId_idx").on(table.configId),
    skuIdIdx: index("Link_skuId_idx").on(table.skuId),
  })
);

// ProsCons model
export const prosCons = sqliteTable(
  "ProsCons",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    deviceId: text("deviceId").notNull(),
    type: text("type").notNull(), // "pro" or "con"
    text: text("text").notNull(),
    source: text("source"),
    category: text("category"),
    createdAt: datetime("createdAt")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime("updatedAt")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    deviceIdIdx: index("ProsCons_deviceId_idx").on(table.deviceId),
    typeIdx: index("ProsCons_type_idx").on(table.type),
  })
);

// DeviceCharacteristics model
export const deviceCharacteristics = sqliteTable(
  "DeviceCharacteristics",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    createdAt: datetime("createdAt").notNull().default(datetimeNow),
    updatedAt: datetime("updatedAt").notNull().default(datetimeNow),
    deviceId: text("deviceId").notNull(),
    raw: text("raw").notNull(),
    // essentials
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    brand: text("brand").notNull(),
    aliases: text("aliases").notNull(), // |-delimited
    releaseDate: datetime("releaseDate"),
    status: text("status").notNull().default("DRAFT"),
    publishedAt: datetime("publishedAt"),
    // design
    height_mm: real("height_mm"),
    width_mm: real("width_mm"),
    thickness_mm: real("thickness_mm"),
    weight_g: real("weight_g"),
    materials: text("materials").notNull(), // |-delimited
    ipRating: text("ipRating"),
    colors: text("colors").notNull(), // |-delimited
    // hardware
    cpu: text("cpu"),
    cpuManufacturer: text("cpuManufacturer"),
    cpuCores: text("cpuCores"), // |-delimited
    gpu: text("gpu"),
    sdSlot: integer("sdSlot", { mode: "boolean" }),
    fingerprintPosition: text("fingerprintPosition"),
    // connectivity
    nfc: integer("nfc", { mode: "boolean" }),
    bluetooth: text("bluetooth"),
    sim: text("sim").notNull(), // |-delimited
    simCount: integer("simCount").notNull(),
    usb: text("usb"),
    headphoneJack: integer("headphoneJack", { mode: "boolean" }),
    // battery
    batteryCapacity_mah: real("batteryCapacity_mah"),
    batteryFastCharging: integer("batteryFastCharging", { mode: "boolean" }),
    batteryWattage: real("batteryWattage"),
    // cameras
    cameraFeatures: text("cameraFeatures").notNull(), // |-delimited
    // software
    os: text("os"),
    osSkin: text("osSkin"),
  },
  (table) => ({
    deviceIdIdx: index("DeviceCharacteristics_deviceId_idx").on(table.deviceId),
    statusIdx: index("DeviceCharacteristics_status_idx").on(table.status),
    slugStatusIdx: index("DeviceCharacteristics_slug_status_idx").on(
      table.slug,
      table.status
    ),
  })
);

// Screen model
export const screen = sqliteTable(
  "Screen",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    characteristicsId: text("characteristicsId").notNull(),
    position: text("position").notNull(),
    size_in: real("size_in"),
    displayType: text("displayType"),
    resolution: text("resolution"),
    aspectRatio: text("aspectRatio"),
    ppi: integer("ppi"),
    displayFeatures: text("displayFeatures"), // |-delimited
    refreshRate: integer("refreshRate"),
    brightnessNits: integer("brightnessNits"),
    isMain: integer("isMain", { mode: "boolean" }).notNull().default(false),
    createdAt: datetime("createdAt")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime("updatedAt")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    characteristicsIdPositionIdx: uniqueIndex(
      "Screen_characteristicsId_position_key"
    ).on(table.characteristicsId, table.position),
    characteristicsIdIdx: index("Screen_characteristicsId_idx").on(
      table.characteristicsId
    ),
  })
);

// Sku model
export const sku = sqliteTable(
  "Sku",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    characteristicsId: text("characteristicsId").notNull(),
    marketId: text("marketId").notNull(), // |-delimited
    ram_gb: integer("ram_gb").notNull(),
    storage_gb: integer("storage_gb").notNull(),
  },
  (table) => ({
    characteristicsIdIdx: index("Sku_characteristicsId_idx").on(
      table.characteristicsId
    ),
    idIdx: index("Sku_id_idx").on(table.id),
  })
);

// Camera model
export const camera = sqliteTable(
  "Camera",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    characteristicsId: text("characteristicsId").notNull(),
    resolution_mp: real("resolution_mp").notNull(),
    aperture_fstop: text("aperture_fstop").notNull(),
    sensor: text("sensor"),
    type: text("type"),
    features: text("features"), // |-delimited
  },
  (table) => ({
    characteristicsIdIdx: index("Camera_characteristicsId_idx").on(
      table.characteristicsId
    ),
  })
);

// Benchmark model
export const benchmark = sqliteTable(
  "Benchmark",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    characteristicsId: text("characteristicsId").notNull(),
    name: text("name").notNull(),
    score: real("score").notNull(),
  },
  (table) => ({
    characteristicsIdIdx: index("Benchmark_characteristicsId_idx").on(
      table.characteristicsId
    ),
  })
);

// ScrapeJob model - persisted job state for scraping operations
export const scrapeJob = sqliteTable(
  "ScrapeJob",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    deviceId: text("deviceId").notNull(),
    userId: text("userId").notNull(),
    // State machine
    step: text("step", {
      enum: [
        "searching",
        "selecting",
        "scraping",
        "done",
        "error",
        "slug_conflict",
        "interrupted",
      ],
    })
      .notNull()
      .default("searching"),
    error: text("error"),
    attempts: integer("attempts").notNull().default(0),
    // Progress tracking
    progressStage: text("progressStage"),
    progressPercent: integer("progressPercent"),
    lastLog: text("lastLog"),
    // Selections/payload
    deviceName: text("deviceName"),
    slug: text("slug"),
    autocompleteOptions: text("autocompleteOptions"), // JSON array
    existingMatches: text("existingMatches"), // JSON array for fast path
    slugConflict: text("slugConflict"), // JSON object
    // Dispatch tracking (for resilience to connection issues)
    scraperRequestId: text("scraperRequestId"),
    dispatchedAt: datetime("dispatchedAt"),
    acknowledgedAt: datetime("acknowledgedAt"),
    // Timestamps
    createdAt: datetime("createdAt")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime("updatedAt")
      .notNull()
      .$defaultFn(() => new Date()),
    finishedAt: datetime("finishedAt"),
  },
  (table) => ({
    userIdUpdatedAtIdx: index("ScrapeJob_userId_updatedAt_idx").on(
      table.userId,
      table.updatedAt
    ),
    stepUpdatedAtIdx: index("ScrapeJob_step_updatedAt_idx").on(
      table.step,
      table.updatedAt
    ),
    deviceIdIdx: uniqueIndex("ScrapeJob_deviceId_key").on(table.deviceId),
  })
);

// RatingsGroup model
export const ratingsGroup = sqliteTable("RatingsGroup", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  displayName: text("displayName"),
  description: text("description"),
  displayType: text("displayType").notNull().default("regular"),
  type: text("type"),
  createdAt: datetime("createdAt")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: datetime("updatedAt")
    .notNull()
    .$defaultFn(() => new Date()),
});

// RatingsPage model
export const ratingsPage = sqliteTable(
  "RatingsPage",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    iconName: text("iconName"),
    status: text("status").notNull().default("DRAFT"),
    publishedAt: datetime("publishedAt"),
    position: integer("position"),
    createdAt: datetime("createdAt")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime("updatedAt")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    statusIdx: index("RatingsPage_status_idx").on(table.status),
    positionIdx: index("RatingsPage_position_idx").on(table.position),
    slugIdx: index("RatingsPage_slug_idx").on(table.slug),
  })
);

// RatingsGroupPosition model
export const ratingsGroupPosition = sqliteTable(
  "RatingsGroupPosition",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    ratingId: text("ratingId").notNull(),
    groupId: text("groupId").notNull(),
    position: integer("position").notNull(),
    shortName: text("shortName"),
    createdAt: datetime("createdAt")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime("updatedAt")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    groupIdRatingIdIdx: uniqueIndex(
      "RatingsGroupPosition_groupId_ratingId_key"
    ).on(table.groupId, table.ratingId),
    groupIdPositionIdx: uniqueIndex(
      "RatingsGroupPosition_groupId_position_key"
    ).on(table.groupId, table.position),
    ratingIdIdx: index("RatingsGroupPosition_ratingId_idx").on(table.ratingId),
    groupIdIdx: index("RatingsGroupPosition_groupId_idx").on(table.groupId),
    positionGroupIdIdx: index("RatingsGroupPosition_position_groupId_idx").on(
      table.position,
      table.groupId
    ),
  })
);

// RatingsPagePosition model
export const ratingsPagePosition = sqliteTable(
  "RatingsPagePosition",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    groupId: text("groupId").notNull(),
    pageId: text("pageId").notNull(),
    position: integer("position").notNull(),
    createdAt: datetime("createdAt")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime("updatedAt")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    pageIdGroupIdIdx: uniqueIndex("RatingsPagePosition_pageId_groupId_key").on(
      table.pageId,
      table.groupId
    ),
    pageIdPositionIdx: uniqueIndex(
      "RatingsPagePosition_pageId_position_key"
    ).on(table.pageId, table.position),
    groupIdIdx: index("RatingsPagePosition_groupId_idx").on(table.groupId),
    pageIdIdx: index("RatingsPagePosition_pageId_idx").on(table.pageId),
    positionPageIdIdx: index("RatingsPagePosition_position_pageId_idx").on(
      table.position,
      table.pageId
    ),
  })
);

// Many-to-many junction tables
export const deviceToRating = sqliteTable(
  "_DeviceToRating",
  {
    A: text("A").notNull(), // deviceId
    B: text("B").notNull(), // ratingId
  },
  (table) => ({
    pk: primaryKey({ columns: [table.A, table.B] }),
    ABIdx: index("_DeviceToRating_AB_unique").on(table.A, table.B),
    BIdx: index("_DeviceToRating_B_index").on(table.B),
  })
);

export const ratingToRatingCategory = sqliteTable(
  "_RatingToRatingCategory",
  {
    A: text("A").notNull(), // ratingId
    B: text("B").notNull(), // ratingCategoryId
  },
  (table) => ({
    pk: primaryKey({ columns: [table.A, table.B] }),
    ABIdx: index("_RatingToRatingCategory_AB_unique").on(table.A, table.B),
    BIdx: index("_RatingToRatingCategory_B_index").on(table.B),
  })
);

export const configToDevice = sqliteTable(
  "_ConfigToDevice",
  {
    A: text("A").notNull(), // configId
    B: text("B").notNull(), // deviceId
  },
  (table) => ({
    pk: primaryKey({ columns: [table.A, table.B] }),
    ABIdx: index("_ConfigToDevice_AB_unique").on(table.A, table.B),
    BIdx: index("_ConfigToDevice_B_index").on(table.B),
  })
);

export const categoryToWidget = sqliteTable(
  "_CategoryToWidget",
  {
    A: text("A").notNull(), // categoryId
    B: text("B").notNull(), // widgetId
  },
  (table) => ({
    pk: primaryKey({ columns: [table.A, table.B] }),
    ABIdx: index("_CategoryToWidget_AB_unique").on(table.A, table.B),
    BIdx: index("_CategoryToWidget_B_index").on(table.B),
  })
);

export const tagToWidget = sqliteTable(
  "_TagToWidget",
  {
    A: text("A").notNull(), // tagId
    B: text("B").notNull(), // widgetId
  },
  (table) => ({
    pk: primaryKey({ columns: [table.A, table.B] }),
    ABIdx: index("_TagToWidget_AB_unique").on(table.A, table.B),
    BIdx: index("_TagToWidget_B_index").on(table.B),
  })
);

// Relations
export const exampleRelations = relations(example, ({}) => ({}));

export const marketplaceRelations = relations(marketplace, ({ many }) => ({
  links: many(link),
}));

export const aliExpressItemRelations = relations(aliExpressItem, ({}) => ({}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const userRelations = relations(user, ({ many }) => ({
  accounts: many(account),
  sessions: many(session),
}));

export const verificationTokenRelations = relations(
  verificationToken,
  ({}) => ({})
);

export const widgetTypeRelations = relations(widgetType, ({ many }) => ({
  widgets: many(widget),
}));

export const categoryRelations = relations(category, ({ many }) => ({
  widgets: many(categoryToWidget),
}));

export const tagRelations = relations(tag, ({ many }) => ({
  widgets: many(tagToWidget),
}));

export const widgetRelations = relations(widget, ({ one, many }) => ({
  type: one(widgetType, {
    fields: [widget.widgetTypeId],
    references: [widgetType.id],
  }),
  devices: many(device),
  categories: many(categoryToWidget),
  tags: many(tagToWidget),
}));

export const deviceRelations = relations(device, ({ one, many }) => ({
  widget: one(widget, {
    fields: [device.widgetId],
    references: [widget.id],
  }),
  links: many(link),
  configs: many(configToDevice),
  ratings: many(deviceToRating),
  ratingPositions: many(ratingPosition),
  characteristics: many(deviceCharacteristics),
  prosCons: many(prosCons),
}));

export const ratingCategoryRelations = relations(
  ratingCategory,
  ({ many }) => ({
    ratings: many(ratingToRatingCategory),
  })
);

export const ratingTypeRelations = relations(ratingType, ({ many }) => ({
  ratings: many(rating),
}));

export const ratingRelations = relations(rating, ({ one, many }) => ({
  ratingType: one(ratingType, {
    fields: [rating.ratingTypeId],
    references: [ratingType.id],
  }),
  devices: many(deviceToRating),
  ratingPositions: many(ratingPosition),
  ratingCategories: many(ratingToRatingCategory),
  ratingsGroupPositions: many(ratingsGroupPosition),
}));

export const ratingPositionRelations = relations(ratingPosition, ({ one }) => ({
  device: one(device, {
    fields: [ratingPosition.deviceId],
    references: [device.id],
  }),
  rating: one(rating, {
    fields: [ratingPosition.ratingId],
    references: [rating.id],
  }),
}));

export const configRelations = relations(config, ({ many }) => ({
  links: many(link),
  devices: many(configToDevice),
}));

export const linkRelations = relations(link, ({ one }) => ({
  config: one(config, {
    fields: [link.configId],
    references: [config.id],
  }),
  device: one(device, {
    fields: [link.deviceId],
    references: [device.id],
  }),
  marketplace: one(marketplace, {
    fields: [link.marketplaceId],
    references: [marketplace.id],
  }),
  sku: one(sku, {
    fields: [link.skuId],
    references: [sku.id],
  }),
}));

export const prosConsRelations = relations(prosCons, ({ one }) => ({
  device: one(device, {
    fields: [prosCons.deviceId],
    references: [device.id],
  }),
}));

export const deviceCharacteristicsRelations = relations(
  deviceCharacteristics,
  ({ one, many }) => ({
    device: one(device, {
      fields: [deviceCharacteristics.deviceId],
      references: [device.id],
    }),
    screens: many(screen),
    skus: many(sku),
    cameras: many(camera),
    benchmarks: many(benchmark),
  })
);

export const screenRelations = relations(screen, ({ one }) => ({
  characteristics: one(deviceCharacteristics, {
    fields: [screen.characteristicsId],
    references: [deviceCharacteristics.id],
  }),
}));

export const skuRelations = relations(sku, ({ one, many }) => ({
  characteristics: one(deviceCharacteristics, {
    fields: [sku.characteristicsId],
    references: [deviceCharacteristics.id],
  }),
  links: many(link),
}));

export const cameraRelations = relations(camera, ({ one }) => ({
  characteristics: one(deviceCharacteristics, {
    fields: [camera.characteristicsId],
    references: [deviceCharacteristics.id],
  }),
}));

export const benchmarkRelations = relations(benchmark, ({ one }) => ({
  characteristics: one(deviceCharacteristics, {
    fields: [benchmark.characteristicsId],
    references: [deviceCharacteristics.id],
  }),
}));

export const scrapeJobRelations = relations(scrapeJob, ({ one }) => ({
  device: one(device, {
    fields: [scrapeJob.deviceId],
    references: [device.id],
  }),
}));

export const ratingsGroupRelations = relations(ratingsGroup, ({ many }) => ({
  ratings: many(ratingsGroupPosition),
  pages: many(ratingsPagePosition),
}));

export const ratingsPageRelations = relations(ratingsPage, ({ many }) => ({
  groups: many(ratingsPagePosition),
}));

export const ratingsGroupPositionRelations = relations(
  ratingsGroupPosition,
  ({ one }) => ({
    rating: one(rating, {
      fields: [ratingsGroupPosition.ratingId],
      references: [rating.id],
    }),
    group: one(ratingsGroup, {
      fields: [ratingsGroupPosition.groupId],
      references: [ratingsGroup.id],
    }),
  })
);

export const ratingsPagePositionRelations = relations(
  ratingsPagePosition,
  ({ one }) => ({
    group: one(ratingsGroup, {
      fields: [ratingsPagePosition.groupId],
      references: [ratingsGroup.id],
    }),
    page: one(ratingsPage, {
      fields: [ratingsPagePosition.pageId],
      references: [ratingsPage.id],
    }),
  })
);

// Many-to-many junction table relations
export const deviceToRatingRelations = relations(deviceToRating, ({ one }) => ({
  device: one(device, {
    fields: [deviceToRating.A],
    references: [device.id],
  }),
  rating: one(rating, {
    fields: [deviceToRating.B],
    references: [rating.id],
  }),
}));

export const ratingToRatingCategoryRelations = relations(
  ratingToRatingCategory,
  ({ one }) => ({
    rating: one(rating, {
      fields: [ratingToRatingCategory.A],
      references: [rating.id],
    }),
    ratingCategory: one(ratingCategory, {
      fields: [ratingToRatingCategory.B],
      references: [ratingCategory.id],
    }),
  })
);

export const configToDeviceRelations = relations(configToDevice, ({ one }) => ({
  config: one(config, {
    fields: [configToDevice.A],
    references: [config.id],
  }),
  device: one(device, {
    fields: [configToDevice.B],
    references: [device.id],
  }),
}));

export const categoryToWidgetRelations = relations(
  categoryToWidget,
  ({ one }) => ({
    category: one(category, {
      fields: [categoryToWidget.A],
      references: [category.id],
    }),
    widget: one(widget, {
      fields: [categoryToWidget.B],
      references: [widget.id],
    }),
  })
);

export const tagToWidgetRelations = relations(tagToWidget, ({ one }) => ({
  tag: one(tag, {
    fields: [tagToWidget.A],
    references: [tag.id],
  }),
  widget: one(widget, {
    fields: [tagToWidget.B],
    references: [widget.id],
  }),
}));

// Type exports
export type Example = InferSelectModel<typeof example>;
export type NewExample = InferInsertModel<typeof example>;

export type Marketplace = InferSelectModel<typeof marketplace>;
export type NewMarketplace = InferInsertModel<typeof marketplace>;

export type AliExpressItem = InferSelectModel<typeof aliExpressItem>;
export type NewAliExpressItem = InferInsertModel<typeof aliExpressItem>;

export type Account = InferSelectModel<typeof account>;
export type NewAccount = InferInsertModel<typeof account>;

export type Session = InferSelectModel<typeof session>;
export type NewSession = InferInsertModel<typeof session>;

export type User = InferSelectModel<typeof user>;
export type NewUser = InferInsertModel<typeof user>;

export type VerificationToken = InferSelectModel<typeof verificationToken>;
export type NewVerificationToken = InferInsertModel<typeof verificationToken>;

export type WidgetType = InferSelectModel<typeof widgetType>;
export type NewWidgetType = InferInsertModel<typeof widgetType>;

export type Category = InferSelectModel<typeof category>;
export type NewCategory = InferInsertModel<typeof category>;

export type Tag = InferSelectModel<typeof tag>;
export type NewTag = InferInsertModel<typeof tag>;

export type Widget = InferSelectModel<typeof widget>;
export type NewWidget = InferInsertModel<typeof widget>;

export type Device = InferSelectModel<typeof device>;
export type NewDevice = InferInsertModel<typeof device>;

export type RatingCategory = InferSelectModel<typeof ratingCategory>;
export type NewRatingCategory = InferInsertModel<typeof ratingCategory>;

export type RatingType = InferSelectModel<typeof ratingType>;
export type NewRatingType = InferInsertModel<typeof ratingType>;

export type Rating = InferSelectModel<typeof rating>;
export type NewRating = InferInsertModel<typeof rating>;

export type RatingPosition = InferSelectModel<typeof ratingPosition>;
export type NewRatingPosition = InferInsertModel<typeof ratingPosition>;

export type Config = InferSelectModel<typeof config>;
export type NewConfig = InferInsertModel<typeof config>;

export type Link = InferSelectModel<typeof link>;
export type NewLink = InferInsertModel<typeof link>;

export type ProsCons = InferSelectModel<typeof prosCons>;
export type NewProsCons = InferInsertModel<typeof prosCons>;

export type DeviceCharacteristics = InferSelectModel<
  typeof deviceCharacteristics
>;
export type NewDeviceCharacteristics = InferInsertModel<
  typeof deviceCharacteristics
>;

export type Screen = InferSelectModel<typeof screen>;
export type NewScreen = InferInsertModel<typeof screen>;

export type Sku = InferSelectModel<typeof sku>;
export type NewSku = InferInsertModel<typeof sku>;

export type Camera = InferSelectModel<typeof camera>;
export type NewCamera = InferInsertModel<typeof camera>;

export type Benchmark = InferSelectModel<typeof benchmark>;
export type NewBenchmark = InferInsertModel<typeof benchmark>;

export type RatingsGroup = InferSelectModel<typeof ratingsGroup>;
export type NewRatingsGroup = InferInsertModel<typeof ratingsGroup>;

export type RatingsPage = InferSelectModel<typeof ratingsPage>;
export type NewRatingsPage = InferInsertModel<typeof ratingsPage>;

export type RatingsGroupPosition = InferSelectModel<
  typeof ratingsGroupPosition
>;
export type NewRatingsGroupPosition = InferInsertModel<
  typeof ratingsGroupPosition
>;

export type RatingsPagePosition = InferSelectModel<typeof ratingsPagePosition>;
export type NewRatingsPagePosition = InferInsertModel<
  typeof ratingsPagePosition
>;

export type ScrapeJob = InferSelectModel<typeof scrapeJob>;
export type NewScrapeJob = InferInsertModel<typeof scrapeJob>;

// Junction table types
export type DeviceToRating = InferSelectModel<typeof deviceToRating>;
export type RatingToRatingCategory = InferSelectModel<
  typeof ratingToRatingCategory
>;
export type ConfigToDevice = InferSelectModel<typeof configToDevice>;
export type CategoryToWidget = InferSelectModel<typeof categoryToWidget>;
export type TagToWidget = InferSelectModel<typeof tagToWidget>;
