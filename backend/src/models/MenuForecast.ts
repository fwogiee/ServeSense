import mongoose, { Document, Schema, Types } from "mongoose";

export interface IMenuForecast extends Document {
  menuItemId: Types.ObjectId;
  weekStartDate: Date;
  predictedQty: number;
  modelUsed: string;
  createdAt: Date;
}

const menuForecastSchema = new Schema<IMenuForecast>(
  {
    menuItemId: { type: Schema.Types.ObjectId, ref: "MenuItem", required: true, index: true },
    weekStartDate: { type: Date, required: true, index: true },
    predictedQty: { type: Number, required: true, min: 0 },
    modelUsed: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

menuForecastSchema.index({ menuItemId: 1, weekStartDate: 1 }, { unique: true });

export const MenuForecast =
  mongoose.models.MenuForecast || mongoose.model<IMenuForecast>("MenuForecast", menuForecastSchema);
