import mongoose, { Document, Schema } from "mongoose";

export interface IIngredient extends Document {
  name: string;
  category?: string;
  unit: string;
  currentStock: number;
  parLevel: number;
  reorderPoint?: number;
  vendor?: string;
  costPerUnit: number;
  reorderUnit?: string;
  conversionFactor?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ingredientSchema = new Schema<IIngredient>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    category: { type: String, trim: true },
    unit: { type: String, required: true, trim: true },
    currentStock: { type: Number, required: true, min: 0, default: 0 },
    parLevel: { type: Number, required: true, min: 0, default: 0 },
    reorderPoint: { type: Number, min: 0 },
    vendor: { type: String, trim: true },
    costPerUnit: { type: Number, required: true, min: 0, default: 0 },
    reorderUnit: { type: String, trim: true },
    conversionFactor: { type: Number, min: 0 },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

export const Ingredient =
  mongoose.models.Ingredient || mongoose.model<IIngredient>("Ingredient", ingredientSchema);
