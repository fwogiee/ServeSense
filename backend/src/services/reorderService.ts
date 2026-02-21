import { Ingredient } from "../models/Ingredient";

interface FinalQtyOverride {
  ingredientId: string;
  finalQty: number;
}

export interface ReorderWorksheetItem {
  ingredientId: string;
  ingredientName: string;
  vendor?: string;
  unit: string;
  costPerUnit: number;
  currentStock: number;
  parLevel: number;
  recommendedQty: number;
  finalQty: number;
  estimatedCost: number;
  reorderUnit?: string;
  conversionFactor?: number;
  recommendedReorderUnits?: number;
  finalReorderUnits?: number;
}

export interface ReorderWorksheet {
  generatedAt: string;
  items: ReorderWorksheetItem[];
  totalEstimatedCost: number;
}

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

export const buildReorderWorksheet = async (
  overrides: FinalQtyOverride[] = []
): Promise<ReorderWorksheet> => {
  const overrideMap = new Map(overrides.map((item) => [item.ingredientId, item.finalQty]));
  const ingredients = await Ingredient.find().sort({ name: 1 }).lean();

  const items = ingredients.map((ingredient) => {
    const recommendedQty = Math.max(0, ingredient.parLevel - ingredient.currentStock);
    const finalQty = Math.max(0, overrideMap.get(String(ingredient._id)) ?? recommendedQty);
    const estimatedCost = finalQty * ingredient.costPerUnit;

    let recommendedReorderUnits: number | undefined;
    let finalReorderUnits: number | undefined;

    if (ingredient.conversionFactor && ingredient.conversionFactor > 0) {
      recommendedReorderUnits = Math.ceil(recommendedQty / ingredient.conversionFactor);
      finalReorderUnits = Math.ceil(finalQty / ingredient.conversionFactor);
    }

    return {
      ingredientId: String(ingredient._id),
      ingredientName: ingredient.name,
      vendor: ingredient.vendor,
      unit: ingredient.unit,
      costPerUnit: round3(ingredient.costPerUnit),
      currentStock: round3(ingredient.currentStock),
      parLevel: round3(ingredient.parLevel),
      recommendedQty: round3(recommendedQty),
      finalQty: round3(finalQty),
      estimatedCost: round3(estimatedCost),
      reorderUnit: ingredient.reorderUnit,
      conversionFactor: ingredient.conversionFactor,
      recommendedReorderUnits,
      finalReorderUnits,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    items,
    totalEstimatedCost: round3(items.reduce((sum, item) => sum + item.estimatedCost, 0)),
  };
};
