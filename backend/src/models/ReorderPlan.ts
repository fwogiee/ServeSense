import mongoose, { Document, Schema, Types } from "mongoose";

interface ReorderPlanItem {
  ingredientId: Types.ObjectId;
  recommendedQty: number;
  finalQty: number;
  estimatedCost: number;
  reorderUnits?: number;
}

export interface IReorderPlan extends Document {
  createdAt: Date;
  createdBy: Types.ObjectId;
  weekStartDate?: Date;
  items: ReorderPlanItem[];
}

const reorderPlanItemSchema = new Schema<ReorderPlanItem>(
  {
    ingredientId: { type: Schema.Types.ObjectId, ref: "Ingredient", required: true },
    recommendedQty: { type: Number, required: true, min: 0 },
    finalQty: { type: Number, required: true, min: 0 },
    estimatedCost: { type: Number, required: true, min: 0 },
    reorderUnits: { type: Number, min: 0 },
  },
  { _id: false }
);

const reorderPlanSchema = new Schema<IReorderPlan>(
  {
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    weekStartDate: { type: Date },
    items: { type: [reorderPlanItemSchema], default: [] },
  },
  { versionKey: false }
);

export const ReorderPlan =
  mongoose.models.ReorderPlan || mongoose.model<IReorderPlan>("ReorderPlan", reorderPlanSchema);
