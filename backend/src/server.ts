import { app } from "./app.js";
import { env } from "./config/env.js";
import { verifyDatabaseConnection } from "./config/database.js";

async function bootstrap(): Promise<void> {
  try {
    await verifyDatabaseConnection();
    app.listen(env.APP_PORT, () => {
      console.log(`API ready at ${env.APP_URL}`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
}

void bootstrap();
