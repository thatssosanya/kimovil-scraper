import { Effect } from "effect";
import { StorageService } from "../../services/storage";

export class YandexImageUploadError extends Error {
  readonly _tag = "YandexImageUploadError";
  constructor(message: string, readonly cause?: unknown) {
    super(message);
  }
}

export const uploadYandexImage = (
  deviceId: string,
  url: string,
  index: number,
): Effect.Effect<string, YandexImageUploadError, StorageService> =>
  Effect.gen(function* () {
    const storage = yield* StorageService;

    const response = yield* Effect.tryPromise({
      try: () => fetch(url),
      catch: (e) => new YandexImageUploadError(`Failed to fetch image: ${e}`, e),
    });

    if (!response.ok) {
      yield* Effect.fail(
        new YandexImageUploadError(`HTTP ${response.status} for ${url}`),
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    
    // Security: Validate content-type is actually an image
    if (!contentType.startsWith("image/")) {
      yield* Effect.fail(
        new YandexImageUploadError(`Invalid content-type for image URL ${url}: ${contentType || "(none)"}`),
      );
    }

    const buffer = Buffer.from(
      yield* Effect.tryPromise({
        try: () => response.arrayBuffer(),
        catch: (e) => new YandexImageUploadError(`Failed to read image buffer: ${e}`, e),
      }),
    );

    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : "jpg";
    const key = `yandex/${deviceId}/${index}.${ext}`;

    yield* storage.putObject({ key, contentType, body: buffer }).pipe(
      Effect.mapError(
        (e) => new YandexImageUploadError(`Failed to upload to storage: ${e}`, e),
      ),
    );

    return storage.publicUrl(key);
  });
