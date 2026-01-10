import { Effect, Layer, Context, Schedule, Duration } from "effect";
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

export class StorageError extends Error {
  readonly _tag = "StorageError";
  readonly key?: string;
  constructor(
    message: string,
    options?: { key?: string; cause?: unknown },
  ) {
    super(message);
    this.key = options?.key;
    if (options?.cause) {
      (this as { cause?: unknown }).cause = options.cause;
    }
  }
}

export interface StorageService {
  readonly putObject: (input: {
    key: string;
    contentType: string;
    body: Buffer;
  }) => Effect.Effect<void, StorageError>;

  readonly objectExists: (key: string) => Effect.Effect<boolean, StorageError>;

  readonly publicUrl: (key: string) => string;
}

export const StorageService = Context.GenericTag<StorageService>("StorageService");

const getEnvOrThrow = (key: string): string => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
};

const makeS3Client = () =>
  new S3Client({
    region: process.env.YA_S3_REGION ?? "ru-central1",
    endpoint: process.env.YA_S3_ENDPOINT ?? "https://storage.yandexcloud.net",
    forcePathStyle: true,
    credentials: {
      accessKeyId: getEnvOrThrow("YA_S3_ACCESS_KEY"),
      secretAccessKey: getEnvOrThrow("YA_S3_SECRET_KEY"),
    },
  });

const retryPolicy = Schedule.exponential(Duration.seconds(1)).pipe(
  Schedule.compose(Schedule.recurs(3)),
);

// Singleton S3 client and bucket - created once on first use
let _s3Client: S3Client | null = null;
let _bucket: string | null = null;

const getS3Client = (): S3Client => {
  if (!_s3Client) {
    _s3Client = makeS3Client();
  }
  return _s3Client;
};

const getBucket = (): string => {
  if (!_bucket) {
    _bucket = getEnvOrThrow("YA_S3_BUCKET");
  }
  return _bucket;
};

export const StorageServiceLive = Layer.succeed(
  StorageService,
  StorageService.of({
    putObject: ({ key, contentType, body }) =>
      Effect.gen(function* () {
        const bucket = getBucket();
        const client = getS3Client();

        yield* Effect.tryPromise({
          try: () =>
            client.send(
              new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: body,
                ContentType: contentType,
              }),
            ),
          catch: (e) =>
            new StorageError(`Failed to upload ${key}: ${e}`, { key, cause: e }),
        }).pipe(Effect.retry(retryPolicy));
      }),

    objectExists: (key) =>
      Effect.gen(function* () {
        const bucket = getBucket();
        const client = getS3Client();

        return yield* Effect.tryPromise({
          try: async () => {
            await client.send(
              new HeadObjectCommand({
                Bucket: bucket,
                Key: key,
              }),
            );
            return true;
          },
          catch: (e) => {
            if ((e as { name?: string }).name === "NotFound") {
              return false;
            }
            throw e;
          },
        }).pipe(
          Effect.catchAll((e) =>
            typeof e === "boolean"
              ? Effect.succeed(e)
              : Effect.fail(
                  new StorageError(`Failed to check ${key}: ${e}`, {
                    key,
                    cause: e,
                  }),
                ),
          ),
        );
      }),

    publicUrl: (key) => {
      const base =
        process.env.CDN_BASE_URL ??
        `https://storage.yandexcloud.net/${process.env.YA_S3_BUCKET ?? "cod-device-images"}`;
      return `${base}/${key}`;
    },
  }),
);
