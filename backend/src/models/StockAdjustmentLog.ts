import mongoose, { Document, Schema, Types } from "mongoose";

export interface IStockAdjustmentLog extends Document {
  ingredientId: Types.ObjectId;
  delta: number;
  reason: string;
  userId: Types.ObjectId;
  createdAt: Date;
}

const stockAdjustmentLogSchema = new Schema<IStockAdjustmentLog>(
  {
    ingredientId: { type: Schema.Types.ObjectId, ref: "Ingredient", required: true, index: true },
    delta: { type: Number, required: true },
    reason: { type: String, required: true, trim: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

export const StockAdjustmentLog =
  mongoose.models.StockAdjustmentLog ||
  mongoose.model<IStockAdjustmentLog>("StockAdjustmentLog", stockAdjustmentLogSchema);
