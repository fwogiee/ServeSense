import app from "./app";
import { connectDatabase } from "./config/db";

const PORT = process.env.PORT || 4000;

const start = async (): Promise<void> => {
  try {
    await connectDatabase();
    app.listen(PORT, () => {
      console.log(`ServeSense API running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

void start();