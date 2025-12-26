export class SlugConflictError extends Error {
  public readonly code = "SLUG_CONFLICT" as const;

  constructor(
    message: string,
    public readonly payload: {
      slug: string;
      existingCharacteristicsId: string;
      existingDeviceId: string;
      existingDeviceName: string | null;
    }
  ) {
    super(message);
    this.name = "SlugConflictError";
  }
}
