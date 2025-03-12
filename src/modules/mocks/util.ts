export const wait = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const withMock = <Args extends unknown[], R>(
  mock: ((...args: Args) => Promise<R>) | undefined,
  fn: (...args: Args) => Promise<R>
) => {
  if (process.env.MOCK_APIS) {
    return mock ?? fn;
  }
  return fn;
};
