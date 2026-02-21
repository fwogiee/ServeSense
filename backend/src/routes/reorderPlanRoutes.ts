import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth";
import { Ingredient } from "../models/Ingredient";
import { ReorderPlan } from "../models/ReorderPlan";
import { buildReorderWorksheet } from "../services/reorderService";
import { asyncHandler } from "../utils/asyncHandler";
import { toCsv } from "../utils/csvExport";
import { ApiError } from "../utils/errors";

const router = Router();

const createPlanSchema = z.object({
  weekStartDate: z.string().optional(),
  items: z
    .array(
      z.object({
        ingredientId: z.string().min(1),
        finalQty: z.number().min(0),
      })
    )
    .optional(),
});

router.use(authenticate, authorize("Admin", "Manager"));

router.get(
  "/worksheet",
  asyncHandler(async (req, res) => {
    let overrides: Array<{ ingredientId: string; finalQty: number }> = [];
    if (typeof req.query.items === "string" && req.query.items.trim()) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(req.query.items);
      } catch (_error) {
        throw new ApiError(400, "Invalid items query payload.");
      }
      const validated = z.array(
        z.object({
          ingredientId: z.string().min(1),
          finalQty: z.number().min(0),
        })
      );
      overrides = validated.parse(parsed);
    }

    const worksheet = await buildReorderWorksheet(overrides);
    res.json(worksheet);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new ApiError(401, "Authentication required.");
    }

    const payload = createPlanSchema.parse(req.body);
    const worksheet = await buildReorderWorksheet(payload.items ?? []);

    const plan = await ReorderPlan.create({
      createdBy: req.user.id,
      createdAt: new Date(),
      weekStartDate: payload.weekStartDate ? new Date(payload.weekStartDate) : undefined,
      items: worksheet.items.map((item) => ({
        ingredientId: item.ingredientId,
        recommendedQty: item.recommendedQty,
        finalQty: item.finalQty,
        estimatedCost: item.estimatedCost,
        reorderUnits: item.finalReorderUnits,
      })),
    });

    res.status(201).json({
      plan,
      worksheet,
    });
  })
);

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const plans = await ReorderPlan.find()
      .populate("createdBy", "email role")
      .populate("items.ingredientId", "name unit vendor")
      .sort({ createdAt: -1 })
      .lean();
    res.json({ items: plans });
  })
);

router.get(
  "/:id/export.csv",
  asyncHandler(async (req, res) => {
    const plan = await ReorderPlan.findById(req.params.id).lean();
    if (!plan) {
      throw new ApiError(404, "Reorder plan not found.");
    }

    const ingredientIds = plan.items.map(
      (item: { ingredientId: unknown }) => item.ingredientId
    );
    const ingredients = await Ingredient.find({ _id: { $in: ingredientIds } }).lean();
    const ingredientMap = new Map(ingredients.map((ingredient) => [String(ingredient._id), ingredient]));

    const rows = plan.items.map(
      (item: {
        ingredientId: unknown;
        recommendedQty: number;
        finalQty: number;
        reorderUnits?: number;
        estimatedCost: number;
      }) => {
      const ingredient = ingredientMap.get(String(item.ingredientId));
      return {
        ingredientName: ingredient?.name ?? "Unknown",
        vendor: ingredient?.vendor ?? "",
        unit: ingredient?.unit ?? "",
        recommendedQty: item.recommendedQty,
        finalQty: item.finalQty,
        reorderUnits: item.reorderUnits ?? "",
        estimatedCost: item.estimatedCost,
      };
      }
    );

    const csv = toCsv(rows, [
      "ingredientName",
      "vendor",
      "unit",
      "recommendedQty",
      "finalQty",
      "reorderUnits",
      "estimatedCost",
    ]);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="reorder-plan-${plan._id.toString()}.csv"`
    );
    res.send(csv);
  })
);

export default router;
