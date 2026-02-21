import mongoose, { Document, Schema, Types } from "mongoose";

export interface IIngredientForecast extends Document {
  ingredientId: Types.ObjectId;
  weekStartDate: Date;
  predictedDemandQty: number;
  createdAt: Date;
}

const ingredientForecastSchema = new Schema<IIngredientForecast>(
  {
    ingredientId: { type: Schema.Types.ObjectId, ref: "Ingredient", required: true, index: true },
    weekStartDate: { type: Date, required: true, index: true },
    predictedDemandQty: { type: Number, required: true, min: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

ingredientForecastSchema.index({ ingredientId: 1, weekStartDate: 1 }, { unique: true });

export const IngredientForecast =
  mongoose.models.IngredientForecast ||
  mongoose.model<IIngredientForecast>("IngredientForecast", ingredientForecastSchema);
