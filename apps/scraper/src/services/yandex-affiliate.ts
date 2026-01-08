import { Effect, Layer, Context, Data, Schedule } from "effect";
import { SqlClient } from "@effect/sql";

export class YandexAffiliateError extends Data.TaggedError("YandexAffiliateError")<{
  message: string;
  cause?: unknown;
}> {}

export interface YandexAffiliateService {
  readonly getOrCreateErid: (params: {
    deviceId: string;
    deviceName: string;
    imageUrl?: string;
  }) => Effect.Effect<string, YandexAffiliateError>;

  readonly createAffiliateLink: (params: {
    url: string;
    erid: string;
  }) => Effect.Effect<string, YandexAffiliateError>;
}

export const YandexAffiliateService =
  Context.GenericTag<YandexAffiliateService>("YandexAffiliateService");

interface CreativeResponse {
  result: string;
  data?: { token: string };
  error?: string;
}

interface AffiliateLinkResponse {
  status: string;
  link?: { url: string };
  error?: string;
}

type WidgetCreativeRow = {
  device_id: string;
  erid: string;
  clid: number;
};

const mapError = (e: unknown): YandexAffiliateError =>
  new YandexAffiliateError({
    message: e instanceof Error ? e.message : String(e),
    cause: e,
  });

const retrySchedule = Schedule.exponential("500 millis").pipe(
  Schedule.intersect(Schedule.recurs(2)),
  Schedule.whileInput((e: YandexAffiliateError) => {
    const cause = e.cause as unknown;
    // Check if cause has HTTP status (from our HTTP error)
    if (cause && typeof cause === "object" && "status" in cause) {
      const status = (cause as { status: number }).status;
      // Retry only on transient server/client-timeout conditions
      return status >= 500 || status === 408 || status === 429;
    }
    // Also retry on network/timeout errors
    return e.message.includes("timeout") || e.message.includes("network");
  }),
);

export const YandexAffiliateServiceLive = Layer.effect(
  YandexAffiliateService,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;

    const clidRaw = process.env.YANDEX_AFFILIATE_CLID;
    const clid = clidRaw ? Number.parseInt(clidRaw, 10) : NaN;
    const apiKey = process.env.YANDEX_AFFILIATE_API_KEY ?? "";

    const affiliateEnabled = Number.isFinite(clid) && clid > 0 && !!apiKey;

    if (!affiliateEnabled) {
      yield* Effect.logWarning(
        "Yandex affiliate disabled: missing or invalid YANDEX_AFFILIATE_CLID / YANDEX_AFFILIATE_API_KEY",
      );
    }

    const request = <T>(
      url: string,
      options: RequestInit,
    ): Effect.Effect<T, YandexAffiliateError> =>
      Effect.gen(function* () {
        const res = yield* Effect.tryPromise({
          try: () => fetch(url, options),
          catch: mapError,
        });

        if (!res.ok) {
          return yield* Effect.fail(
            new YandexAffiliateError({
              message: `HTTP ${res.status}: ${res.statusText}`,
              cause: { status: res.status },
            }),
          );
        }

        return yield* Effect.tryPromise({
          try: () => res.json() as Promise<T>,
          catch: mapError,
        });
      }).pipe(Effect.retry(retrySchedule));

    const getEridFromDb = (
      deviceId: string,
    ): Effect.Effect<string | null, YandexAffiliateError> =>
      Effect.gen(function* () {
        const rows = yield* sql<WidgetCreativeRow>`
          SELECT erid FROM widget_creatives WHERE device_id = ${deviceId}
        `.pipe(Effect.mapError(mapError));

        return rows.length > 0 ? rows[0].erid : null;
      });

    const upsertErid = (
      deviceId: string,
      erid: string,
    ): Effect.Effect<void, YandexAffiliateError> =>
      sql`
        INSERT INTO widget_creatives (device_id, erid, clid)
        VALUES (${deviceId}, ${erid}, ${clid})
        ON CONFLICT(device_id) DO UPDATE SET
          erid = EXCLUDED.erid,
          clid = EXCLUDED.clid,
          updated_at = CURRENT_TIMESTAMP
      `.pipe(
        Effect.asVoid,
        Effect.mapError(mapError),
      );

    const createCreative = (params: {
      deviceId: string;
      deviceName: string;
      imageUrl?: string;
    }): Effect.Effect<string, YandexAffiliateError> =>
      Effect.gen(function* () {
        const mediaData = params.imageUrl
          ? [{ media_url: params.imageUrl, media_url_file_type: "image" }]
          : [];

        const body = {
          clid,
          form: "text-graphic-block",
          text_data: [params.deviceName],
          media_data: mediaData,
          description: `Рекламный креатив для ${params.deviceName}`,
        };

        const response = yield* request<CreativeResponse>(
          "https://distribution.yandex.net/api/v2/creatives/",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );

        if (response.result !== "ok" || !response.data?.token) {
          return yield* Effect.fail(
            new YandexAffiliateError({
              message: `Creative creation failed: ${response.error ?? "no token returned"}`,
            }),
          );
        }

        return response.data.token;
      });

    const notConfiguredError = new YandexAffiliateError({
      message: "Yandex affiliate is not configured",
    });

    return YandexAffiliateService.of({
      getOrCreateErid: (params) =>
        affiliateEnabled
          ? Effect.gen(function* () {
              const existingErid = yield* getEridFromDb(params.deviceId);
              if (existingErid) {
                return existingErid;
              }

              const newErid = yield* createCreative(params);

              yield* upsertErid(params.deviceId, newErid).pipe(
                Effect.catchAll((error) =>
                  Effect.logWarning("Failed to save ERID to database").pipe(
                    Effect.annotateLogs({ deviceId: params.deviceId, error }),
                  ),
                ),
              );

              return newErid;
            })
          : Effect.fail(notConfiguredError),

      createAffiliateLink: (params) =>
        affiliateEnabled
          ? Effect.gen(function* () {
              const encodedUrl = encodeURIComponent(params.url);
              const url = `https://api.content.market.yandex.ru/v3/affiliate/partner/link/create?url=${encodedUrl}&clid=${clid}&erid=${params.erid}&format=json`;

              const response = yield* request<AffiliateLinkResponse>(url, {
                method: "GET",
                headers: { Authorization: apiKey },
              });

              if (response.status !== "OK" || !response.link?.url) {
                return yield* Effect.fail(
                  new YandexAffiliateError({
                    message: `Affiliate link creation failed: ${response.error ?? "no URL returned"}`,
                  }),
                );
              }

              return response.link.url;
            })
          : Effect.fail(notConfiguredError),
    });
  }),
);
