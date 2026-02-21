import { Ingredient } from "../models/Ingredient";
import { MenuItem } from "../models/MenuItem";
import { RecipeLine } from "../models/RecipeLine";
import { SalesRecord } from "../models/SalesRecord";
import { parseDateRange } from "../utils/dateRange";

interface UsageOptions {
  from?: string;
  to?: string;
  includeStockImpact?: boolean;
}

interface BlockedUsageResponse {
  blocked: true;
  message: string;
  range: { from: string; to: string };
  unmappedMenuItems?: Array<{ menuItemName: string; records: number }>;
  missingRecipes?: Array<{ menuItemId: string; menuItemName: string }>;
}

interface UsageItem {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  totalUsed: number;
  estimatedCost: number;
  projectedStock?: number;
  topContributingMenuItems: Array<{
    menuItemId: string;
    menuItemName: string;
    usedQty: number;
  }>;
}

interface UsageSuccessResponse {
  blocked: false;
  range: { from: string; to: string };
  salesCount: number;
  items: UsageItem[];
  totals: {
    ingredientCount: number;
    estimatedCost: number;
  };
}

type UsageResponse = BlockedUsageResponse | UsageSuccessResponse;

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

export const computeIngredientUsage = async (options: UsageOptions): Promise<UsageResponse> => {
  const range = parseDateRange(options.from, options.to);

  const sales = await SalesRecord.find({
    date: { $gte: range.from, $lte: range.to },
  })
    .sort({ date: 1 })
    .lean();

  if (sales.length === 0) {
    return {
      blocked: false,
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      salesCount: 0,
      items: [],
      totals: { ingredientCount: 0, estimatedCost: 0 },
    };
  }

  const unmapped = new Map<string, number>();
  for (const sale of sales) {
    if (!sale.menuItemId) {
      const key = sale.menuItemName;
      unmapped.set(key, (unmapped.get(key) ?? 0) + 1);
    }
  }

  if (unmapped.size > 0) {
    return {
      blocked: true,
      message:
        "Usage is blocked: there are sales rows with unmapped menu items. Map menu items first.",
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      unmappedMenuItems: [...unmapped.entries()].map(([menuItemName, records]) => ({
        menuItemName,
        records,
      })),
    };
  }

  const menuItemIds = [...new Set(sales.map((sale) => String(sale.menuItemId)))];
  const recipeLines = await RecipeLine.find({
    menuItemId: { $in: menuItemIds },
  }).lean();

  const recipeByMenuItemId = new Map<string, typeof recipeLines>();
  for (const line of recipeLines) {
    const key = String(line.menuItemId);
    const current = recipeByMenuItemId.get(key) ?? [];
    current.push(line);
    recipeByMenuItemId.set(key, current);
  }

  const missingRecipeMenuItemIds = menuItemIds.filter((id) => !recipeByMenuItemId.has(id));
  if (missingRecipeMenuItemIds.length > 0) {
    const missingMenuItems = await MenuItem.find({ _id: { $in: missingRecipeMenuItemIds } })
      .select("_id name")
      .lean();

    return {
      blocked: true,
      message:
        "Usage is blocked: some menu items in sales do not have recipe mapping. Add recipe lines first.",
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      missingRecipes: missingMenuItems.map((item) => ({
        menuItemId: String(item._id),
        menuItemName: item.name,
      })),
    };
  }

  const ingredientIds = [...new Set(recipeLines.map((line) => String(line.ingredientId)))];
  const [ingredients, menuItems] = await Promise.all([
    Ingredient.find({ _id: { $in: ingredientIds } }).lean(),
    MenuItem.find({ _id: { $in: menuItemIds } }).select("_id name").lean(),
  ]);

  const ingredientMap = new Map(ingredients.map((ingredient) => [String(ingredient._id), ingredient]));
  const menuItemNameById = new Map(menuItems.map((item) => [String(item._id), item.name]));

  const usageByIngredient = new Map<
    string,
    {
      totalUsed: number;
      estimatedCost: number;
      ingredientName: string;
      unit: string;
      currentStock: number;
      contributions: Map<string, number>;
    }
  >();

  for (const sale of sales) {
    const menuItemId = String(sale.menuItemId);
    const lines = recipeByMenuItemId.get(menuItemId) ?? [];

    for (const line of lines) {
      const ingredientId = String(line.ingredientId);
      const ingredient = ingredientMap.get(ingredientId);
      if (!ingredient) {
        continue;
      }

      const usedQty = sale.qtySold * line.qtyPerMenuItem;
      const existing = usageByIngredient.get(ingredientId) ?? {
        totalUsed: 0,
        estimatedCost: 0,
        ingredientName: ingredient.name,
        unit: ingredient.unit,
        currentStock: ingredient.currentStock,
        contributions: new Map<string, number>(),
      };

      existing.totalUsed += usedQty;
      existing.estimatedCost += usedQty * ingredient.costPerUnit;
      existing.contributions.set(
        menuItemId,
        (existing.contributions.get(menuItemId) ?? 0) + usedQty
      );

      usageByIngredient.set(ingredientId, existing);
    }
  }

  const items: UsageItem[] = [...usageByIngredient.entries()]
    .map(([ingredientId, entry]) => {
      const topContributingMenuItems = [...entry.contributions.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([menuItemId, usedQty]) => ({
          menuItemId,
          menuItemName: menuItemNameById.get(menuItemId) ?? "Unknown",
          usedQty: round3(usedQty),
        }));

      return {
        ingredientId,
        ingredientName: entry.ingredientName,
        unit: entry.unit,
        totalUsed: round3(entry.totalUsed),
        estimatedCost: round3(entry.estimatedCost),
        projectedStock: options.includeStockImpact
          ? round3(entry.currentStock - entry.totalUsed)
          : undefined,
        topContributingMenuItems,
      };
    })
    .sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));

  const totalCost = round3(items.reduce((sum, item) => sum + item.estimatedCost, 0));

  return {
    blocked: false,
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    salesCount: sales.length,
    items,
    totals: {
      ingredientCount: items.length,
      estimatedCost: totalCost,
    },
  };
};
