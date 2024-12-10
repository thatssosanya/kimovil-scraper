// for manual captcha solution. press Enter on the CLI to continue
export const debugPause = async (): Promise<void> => {
  return new Promise((resolve) => {
    if (process.env.ENV !== "development") {
      return resolve();
    }
    console.log("Press Enter to continue...");
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    process.stdin.once("data", () => {
      process.stdin.pause();
      return resolve();
    });
  });
};
