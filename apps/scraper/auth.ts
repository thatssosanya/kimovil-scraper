import { createAuth } from "@repo/auth";
import { config } from "./src/config";

export const auth = createAuth(config.auth);
