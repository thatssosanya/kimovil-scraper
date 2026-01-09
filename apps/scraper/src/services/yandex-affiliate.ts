import { Effect, Layer, Context, Data, Schedule, Ref } from "effect";
import { SqlClient } from "@effect/sql";

export class YandexAffiliateError extends Data.TaggedError("YandexAffiliateError")<{
  message: string;
  cause?: unknown;
}> {}

export interface YandexAffiliateService {
  /**
   * Get ERID from database only - no creation
   */
  readonly getErid: (deviceId: string) => Effect.Effect<string | null, YandexAffiliateError>;

  /**
   * Create a creative with Yandex API and store ERID - admin-only operation
   */
  readonly createAndStoreErid: (params: {
    deviceId: string;
    deviceName: string;
    imageUrl: string;
    description?: string;
  }) => Effect.Effect<string, YandexAffiliateError>;

  /**
   * Build a basic CLID-only affiliate URL - no API call needed
   */
  readonly buildBasicAffiliateUrl: (url: string) => Effect.Effect<string, YandexAffiliateError>;

  /**
   * Create a full affiliate link using ERID via Yandex API
   */
  readonly createAffiliateLinkWithErid: (params: {
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

interface YandexOAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface CachedOAuthToken {
  token: string;
  expiresAt: number;
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
    if (cause && typeof cause === "object" && "status" in cause) {
      const status = (cause as { status: number }).status;
      return status >= 500 || status === 408 || status === 429;
    }
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
    const oauthClientId = process.env.YANDEX_OAUTH_CLIENT_ID ?? "";
    const oauthClientSecret = process.env.YANDEX_OAUTH_CLIENT_SECRET ?? "";
    const oauthTokenUrl = "https://oauth.yandex.ru/token";

    const affiliateLinksEnabled = Number.isFinite(clid) && clid > 0 && !!apiKey;
    const creativesEnabled =
      Number.isFinite(clid) && clid > 0 && !!oauthClientId && !!oauthClientSecret;

    if (!affiliateLinksEnabled) {
      yield* Effect.logWarning(
        "Yandex affiliate links disabled: missing or invalid YANDEX_AFFILIATE_CLID / YANDEX_AFFILIATE_API_KEY",
      );
    }

    if (!creativesEnabled) {
      yield* Effect.logWarning(
        "Yandex creatives disabled: missing or invalid YANDEX_AFFILIATE_CLID / YANDEX_OAUTH_CLIENT_ID / YANDEX_OAUTH_CLIENT_SECRET",
      );
    }

    const tokenRef = yield* Ref.make<CachedOAuthToken | null>(null);

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

    const fetchNewOAuthToken = (): Effect.Effect<CachedOAuthToken, YandexAffiliateError> =>
      Effect.gen(function* () {
        const body = new URLSearchParams({
          grant_type: "client_credentials",
          client_id: oauthClientId,
          client_secret: oauthClientSecret,
        });

        const res = yield* Effect.tryPromise({
          try: () =>
            fetch(oauthTokenUrl, {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: body.toString(),
            }),
          catch: mapError,
        });

        if (!res.ok) {
          return yield* Effect.fail(
            new YandexAffiliateError({
              message: `OAuth token request failed: HTTP ${res.status}`,
              cause: { status: res.status },
            }),
          );
        }

        const data = yield* Effect.tryPromise({
          try: () => res.json() as Promise<YandexOAuthTokenResponse>,
          catch: mapError,
        });

        if (!data.access_token) {
          return yield* Effect.fail(
            new YandexAffiliateError({ message: "OAuth response missing access_token" }),
          );
        }

        const expiresInMs = (data.expires_in ?? 3600) * 1000;
        const cached: CachedOAuthToken = {
          token: data.access_token,
          expiresAt: Date.now() + expiresInMs,
        };

        yield* Ref.set(tokenRef, cached);
        return cached;
      });

    const getOAuthToken = (): Effect.Effect<string, YandexAffiliateError> =>
      Effect.gen(function* () {
        if (!creativesEnabled) {
          return yield* Effect.fail(
            new YandexAffiliateError({ message: "Yandex creatives not configured" }),
          );
        }

        const cached = yield* Ref.get(tokenRef);
        const now = Date.now();

        if (cached && cached.expiresAt - 60_000 > now) {
          return cached.token;
        }

        const fresh = yield* fetchNewOAuthToken();
        return fresh.token;
      });

    const createCreative = (params: {
      deviceId: string;
      deviceName: string;
      imageUrl: string;
      description?: string;
    }): Effect.Effect<string, YandexAffiliateError> =>
      Effect.gen(function* () {
        const token = yield* getOAuthToken();

        const body = {
          clid,
          form: "text-graphic-block",
          text_data: [params.deviceName],
          media_data: [{ media_url: params.imageUrl, media_url_file_type: "image" }],
          description: params.description ?? `Рекламный креатив для ${params.deviceName}`,
        };

        const doRequest = (authToken: string) =>
          request<CreativeResponse>("https://distribution.yandex.net/api/v2/creatives/", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `OAuth ${authToken}`,
            },
            body: JSON.stringify(body),
          });

        const response = yield* doRequest(token).pipe(
          Effect.catchIf(
            (e) => {
              const cause = e.cause as unknown;
              return (
                cause != null &&
                typeof cause === "object" &&
                "status" in cause &&
                (cause as { status: number }).status === 401
              );
            },
            () =>
              Effect.gen(function* () {
                yield* Ref.set(tokenRef, null);
                const freshToken = yield* fetchNewOAuthToken();
                return yield* doRequest(freshToken.token);
              }),
          ),
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

    const creativesNotConfiguredError = new YandexAffiliateError({
      message: "Yandex creatives not configured",
    });

    const affiliateLinksNotConfiguredError = new YandexAffiliateError({
      message: "Yandex affiliate links not configured",
    });

    return YandexAffiliateService.of({
      getErid: (deviceId) =>
        getEridFromDb(deviceId),

      createAndStoreErid: (params) =>
        creativesEnabled
          ? Effect.gen(function* () {
              const newErid = yield* createCreative(params);

              yield* upsertErid(params.deviceId, newErid).pipe(
                Effect.catchAll((error) =>
                  Effect.gen(function* () {
                    yield* Effect.logWarning("Failed to save ERID to database").pipe(
                      Effect.annotateLogs({ deviceId: params.deviceId, error }),
                    );
                    return yield* Effect.fail(
                      new YandexAffiliateError({
                        message: "Created ERID but failed to save to database",
                        cause: error,
                      }),
                    );
                  }),
                ),
              );

              return newErid;
            })
          : Effect.fail(creativesNotConfiguredError),

      buildBasicAffiliateUrl: (url) =>
        affiliateLinksEnabled
          ? Effect.gen(function* () {
              const encodedUrl = encodeURIComponent(url);
              const apiUrl = `https://api.content.market.yandex.ru/v3/affiliate/partner/link/create?url=${encodedUrl}&clid=${clid}&format=json`;

              const response = yield* request<AffiliateLinkResponse>(apiUrl, {
                method: "GET",
                headers: { Authorization: apiKey },
              });

              if (response.status !== "OK" || !response.link?.url) {
                return yield* Effect.fail(
                  new YandexAffiliateError({
                    message: `Basic affiliate link creation failed: ${response.error ?? "no URL returned"}`,
                  }),
                );
              }

              return response.link.url;
            })
          : Effect.fail(affiliateLinksNotConfiguredError),

      createAffiliateLinkWithErid: (params) =>
        affiliateLinksEnabled
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
          : Effect.fail(affiliateLinksNotConfiguredError),
    });
  }),
);
