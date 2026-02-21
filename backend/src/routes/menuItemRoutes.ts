import { Router } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth";
import { Ingredient } from "../models/Ingredient";
import { MenuItem } from "../models/MenuItem";
import { RecipeLine } from "../models/RecipeLine";
import { SalesRecord } from "../models/SalesRecord";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/errors";
import { collapseSpaces, normalizeMenuItemName } from "../utils/normalize";

const router = Router();

const menuItemSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
});

const menuItemUpdateSchema = menuItemSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "Provide at least one field to update."
);

const recipeLineSchema = z.object({
  ingredientId: z.string().min(1),
  qtyPerMenuItem: z.number().gt(0),
  unit: z.string().min(1),
});

const recipeUpdateSchema = z.object({
  lines: z.array(recipeLineSchema),
});

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

router.use(authenticate, authorize("Admin", "Manager"));

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
    const isActiveRaw = req.query.isActive;

    const filter: Record<string, unknown> = {};
    if (q) {
      const regex = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ name: regex }, { category: regex }];
    }
    if (typeof isActiveRaw === "string") {
      filter.isActive = isActiveRaw === "true";
    }

    const items = await MenuItem.find(filter).sort({ name: 1 }).lean();
    res.json({ items, total: items.length });
  })
);

router.get(
  "/unmapped",
  asyncHandler(async (_req, res) => {
    const pipeline: Record<string, unknown>[] = [
      { $match: { $or: [{ menuItemId: { $exists: false } }, { menuItemId: null }] } },
      {
        $group: {
          _id: "$menuItemName",
          count: { $sum: 1 },
          lastSeen: { $max: "$date" },
        },
      },
      { $sort: { count: -1 as const, _id: 1 as const } },
    ];

    const results = await SalesRecord.aggregate<{
      _id: string;
      count: number;
      lastSeen: Date;
    }>(pipeline as never);

    res.json({
      items: results.map((entry) => ({
        menuItemName: entry._id,
        records: entry.count,
        lastSeen: entry.lastSeen,
      })),
    });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = menuItemSchema.parse(req.body);
    const name = collapseSpaces(payload.name);
    const normalizedName = normalizeMenuItemName(name);

    const existing = await MenuItem.findOne({ normalizedName });
    if (existing) {
      throw new ApiError(409, "Menu item with that name already exists.");
    }

    const item = await MenuItem.create({
      name,
      normalizedName,
      category: payload.category,
      isActive: payload.isActive ?? true,
    });

    res.status(201).json(item);
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const payload = menuItemUpdateSchema.parse(req.body);
    const updateData: Record<string, unknown> = { ...payload };

    if (payload.name) {
      const name = collapseSpaces(payload.name);
      const normalizedName = normalizeMenuItemName(name);
      const duplicate = await MenuItem.findOne({
        normalizedName,
        _id: { $ne: req.params.id },
      });
      if (duplicate) {
        throw new ApiError(409, "Menu item with that name already exists.");
      }
      updateData.name = name;
      updateData.normalizedName = normalizedName;
    }

    const item = await MenuItem.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });
    if (!item) {
      throw new ApiError(404, "Menu item not found.");
    }

    if (payload.name) {
      await SalesRecord.updateMany(
        { menuItemId: item._id },
        {
          $set: {
            menuItemName: item.name,
            normalizedMenuItemName: item.normalizedName,
          },
        }
      );
    }

    res.json(item);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const item = await MenuItem.findByIdAndDelete(req.params.id);
    if (!item) {
      throw new ApiError(404, "Menu item not found.");
    }
    await Promise.all([
      RecipeLine.deleteMany({ menuItemId: item._id }),
      SalesRecord.updateMany({ menuItemId: item._id }, { $unset: { menuItemId: "" } }),
    ]);
    res.status(204).send();
  })
);

router.get(
  "/:id/recipe",
  asyncHandler(async (req, res) => {
    const menuItem = await MenuItem.findById(req.params.id).lean();
    if (!menuItem) {
      throw new ApiError(404, "Menu item not found.");
    }

    const lines = await RecipeLine.find({ menuItemId: req.params.id })
      .populate("ingredientId", "name unit category")
      .sort({ createdAt: 1 })
      .lean();

    res.json({ menuItem, lines });
  })
);

router.put(
  "/:id/recipe",
  asyncHandler(async (req, res) => {
    const payload = recipeUpdateSchema.parse(req.body);

    const menuItem = await MenuItem.findById(req.params.id).lean();
    if (!menuItem) {
      throw new ApiError(404, "Menu item not found.");
    }

    const ingredientIds = payload.lines.map((line) => line.ingredientId);
    const uniqueIngredientIds = [...new Set(ingredientIds)];
    if (ingredientIds.length !== uniqueIngredientIds.length) {
      throw new ApiError(400, "Recipe cannot include the same ingredient multiple times.");
    }

    const ingredients = await Ingredient.find({ _id: { $in: uniqueIngredientIds } }).lean();
    if (ingredients.length !== uniqueIngredientIds.length) {
      throw new ApiError(400, "Recipe contains invalid ingredient IDs.");
    }

    const ingredientUnitById = new Map(
      ingredients.map((ingredient) => [String(ingredient._id), ingredient.unit])
    );

    for (const line of payload.lines) {
      const ingredientUnit = ingredientUnitById.get(line.ingredientId);
      if (!ingredientUnit) {
        throw new ApiError(400, `Ingredient ${line.ingredientId} not found.`);
      }
      if (line.unit !== ingredientUnit) {
        throw new ApiError(
          400,
          `Unit mismatch for ingredient ${line.ingredientId}: expected ${ingredientUnit}.`
        );
      }
    }

    await RecipeLine.deleteMany({ menuItemId: req.params.id });
    if (payload.lines.length > 0) {
      await RecipeLine.insertMany(
        payload.lines.map((line) => ({
          menuItemId: req.params.id,
          ingredientId: line.ingredientId,
          qtyPerMenuItem: line.qtyPerMenuItem,
          unit: line.unit,
        }))
      );
    }

    const lines = await RecipeLine.find({ menuItemId: req.params.id })
      .populate("ingredientId", "name unit category")
      .sort({ createdAt: 1 })
      .lean();

    res.json({ menuItem, lines });
  })
);

export default router;
