import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { asyncHandler } from "../utils/asyncHandler";
import { computeIngredientUsage } from "../services/usageService";

const router = Router();

router.use(authenticate, authorize("Admin", "Manager"));

router.get(
  "/ingredients",
  asyncHandler(async (req, res) => {
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    const includeStockImpact = req.query.includeStockImpact === "true";

    const result = await computeIngredientUsage({ from, to, includeStockImpact });
    if (result.blocked) {
      res.status(409).json(result);
      return;
    }
    res.json(result);
  })
);

export default router;
