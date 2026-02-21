import mongoose, { Document, Schema, Types } from "mongoose";

export interface IRecipeLine extends Document {
  menuItemId: Types.ObjectId;
  ingredientId: Types.ObjectId;
  qtyPerMenuItem: number;
  unit: string;
  createdAt: Date;
  updatedAt: Date;
}

const recipeLineSchema = new Schema<IRecipeLine>(
  {
    menuItemId: { type: Schema.Types.ObjectId, ref: "MenuItem", required: true, index: true },
    ingredientId: { type: Schema.Types.ObjectId, ref: "Ingredient", required: true, index: true },
    qtyPerMenuItem: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

recipeLineSchema.index({ menuItemId: 1, ingredientId: 1 }, { unique: true });

export const RecipeLine =
  mongoose.models.RecipeLine || mongoose.model<IRecipeLine>("RecipeLine", recipeLineSchema);
