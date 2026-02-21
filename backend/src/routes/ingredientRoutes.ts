import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth";
import { Ingredient } from "../models/Ingredient";
import { RecipeLine } from "../models/RecipeLine";
import { StockAdjustmentLog } from "../models/StockAdjustmentLog";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/errors";

const router = Router();

const ingredientSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  unit: z.string().min(1),
  currentStock: z.number().min(0),
  parLevel: z.number().min(0),
  reorderPoint: z.number().min(0).optional(),
  vendor: z.string().optional(),
  costPerUnit: z.number().min(0),
  reorderUnit: z.string().optional(),
  conversionFactor: z.number().gt(0).optional(),
  notes: z.string().optional(),
});

const ingredientUpdateSchema = ingredientSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "Provide at least one field to update."
);

const adjustSchema = z.object({
  delta: z.number().refine((value) => value !== 0, "Delta cannot be zero."),
  reason: z.string().min(3),
});

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isLowStock = (ingredient: {
  currentStock: number;
  parLevel: number;
  reorderPoint?: number;
}): boolean => {
  const threshold = ingredient.reorderPoint ?? ingredient.parLevel;
  return ingredient.currentStock <= threshold;
};

router.use(authenticate, authorize("Admin", "Manager"));

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
    const category =
      typeof req.query.category === "string" ? req.query.category.trim() : undefined;
    const lowStock = req.query.lowStock === "true";

    const filter: Record<string, unknown> = {};
    if (q) {
      const regex = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ name: regex }, { category: regex }, { vendor: regex }];
    }
    if (category) {
      filter.category = category;
    }

    const ingredients = await Ingredient.find(filter).sort({ name: 1 }).lean();
    const withStatus = ingredients.map((ingredient) => ({
      ...ingredient,
      lowStock: isLowStock(ingredient),
    }));

    res.json({
      items: lowStock ? withStatus.filter((ingredient) => ingredient.lowStock) : withStatus,
      total: lowStock ? withStatus.filter((ingredient) => ingredient.lowStock).length : withStatus.length,
    });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = ingredientSchema.parse(req.body);
    const ingredient = await Ingredient.create(payload);
    res.status(201).json(ingredient);
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const payload = ingredientUpdateSchema.parse(req.body);
    const ingredient = await Ingredient.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    });
    if (!ingredient) {
      throw new ApiError(404, "Ingredient not found.");
    }
    res.json(ingredient);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const recipeUsage = await RecipeLine.findOne({ ingredientId: req.params.id }).lean();
    if (recipeUsage) {
      throw new ApiError(
        409,
        "Cannot delete ingredient used in recipe mappings. Remove recipe lines first."
      );
    }

    const ingredient = await Ingredient.findByIdAndDelete(req.params.id);
    if (!ingredient) {
      throw new ApiError(404, "Ingredient not found.");
    }

    await StockAdjustmentLog.deleteMany({ ingredientId: ingredient._id });
    res.status(204).send();
  })
);

router.post(
  "/:id/adjust",
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new ApiError(401, "Authentication required.");
    }

    const payload = adjustSchema.parse(req.body);
    const ingredient = await Ingredient.findById(req.params.id);
    if (!ingredient) {
      throw new ApiError(404, "Ingredient not found.");
    }

    const newStock = ingredient.currentStock + payload.delta;
    if (newStock < 0) {
      throw new ApiError(400, "Stock adjustment cannot make inventory negative.");
    }

    ingredient.currentStock = newStock;
    await ingredient.save();

    const log = await StockAdjustmentLog.create({
      ingredientId: ingredient._id,
      delta: payload.delta,
      reason: payload.reason,
      userId: req.user.id,
    });

    res.json({
      ingredient,
      adjustmentLog: log,
    });
  })
);

router.get(
  "/:id/adjustments",
  asyncHandler(async (req, res) => {
    const logs = await StockAdjustmentLog.find({ ingredientId: req.params.id })
      .populate("userId", "email role")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ items: logs });
  })
);

export default router;
