import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import authRoutes from "./routes/authRoutes";
import ingredientRoutes from "./routes/ingredientRoutes";
import menuItemRoutes from "./routes/menuItemRoutes";
import reorderPlanRoutes from "./routes/reorderPlanRoutes";
import salesRoutes from "./routes/salesRoutes";
import usageRoutes from "./routes/usageRoutes";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_ORIGIN.split(",").map((origin) => origin.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: "5mb" }));
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    app: "ServeSense API",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/ingredients", ingredientRoutes);
app.use("/api/menu-items", menuItemRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/usage", usageRoutes);
app.use("/api/reorder-plans", reorderPlanRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
