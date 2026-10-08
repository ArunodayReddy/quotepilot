/** API bootstrap: wire the app and listen. `npm run dev` / `npm start`. */
import { createApp } from "./app.js";
import { config } from "./lib/config.js";
import { logger } from "./lib/logger.js";

const app = createApp();

app.listen(config.port, () => {
  logger.info({
    msg: "api_listening",
    port: config.port,
    version: config.version,
    env: config.nodeEnv,
  });
});
