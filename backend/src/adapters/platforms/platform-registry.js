import { HttpError } from "../../lib/errors.js";
import { createFacebookAdapter } from "./facebook-adapter.js";
import { createInstagramAdapter } from "./instagram-adapter.js";
import { createTiktokAdapter } from "./tiktok-adapter.js";

export function createPlatformRegistry({ fixturesDir }) {
  const adapters = new Map([
    ["instagram", createInstagramAdapter({ fixturesDir })],
    ["facebook", createFacebookAdapter({ fixturesDir })],
    ["tiktok", createTiktokAdapter({ fixturesDir })],
  ]);

  return {
    get(platform) {
      if (!adapters.has(platform)) {
        throw new HttpError(400, "PLATFORM_UNSUPPORTED", `目前不支援的平台：${platform}`);
      }

      return adapters.get(platform);
    },
  };
}
