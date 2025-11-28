import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { isProduction } from "./config/env.js";
import { router } from "./routes/index.js";
import { notFoundHandler } from "./middleware/not-found-handler.js";
import { errorHandler } from "./middleware/error-handler.js";

const app = express();

app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({
  origin: isProduction ? ["https://varaaha.com", "https://www.varaaha.com"] : "*",
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan(isProduction ? "combined" : "dev"));
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.use("/api", router);
app.use(notFoundHandler);
app.use(errorHandler);

export { app };
