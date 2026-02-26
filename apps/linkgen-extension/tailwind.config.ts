import { defineConfig } from "@twind/core";
import presetTailwind from "@twind/preset-tailwind";
import presetAutoprefix from "@twind/preset-autoprefix";
import presetLineClamp from "@twind/preset-line-clamp";

export default defineConfig({
  presets: [presetAutoprefix(), presetTailwind(), presetLineClamp()],
});
