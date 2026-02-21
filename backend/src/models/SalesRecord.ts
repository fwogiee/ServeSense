import mongoose, { Document, Schema, Types } from "mongoose";

export interface ISalesRecord extends Document {
  date: Date;
  menuItemName: string;
  normalizedMenuItemName: string;
  menuItemId?: Types.ObjectId;
  qtySold: number;
  revenue?: number;
  channel?: string;
  importJobId?: Types.ObjectId;
  createdAt: Date;
}

const salesRecordSchema = new Schema<ISalesRecord>(
  {
    date: { type: Date, required: true, index: true },
    menuItemName: { type: String, required: true, trim: true },
    normalizedMenuItemName: { type: String, required: true, trim: true, index: true },
    menuItemId: { type: Schema.Types.ObjectId, ref: "MenuItem", index: true },
    qtySold: { type: Number, required: true, min: 0 },
    revenue: { type: Number, min: 0 },
    channel: { type: String, trim: true },
    importJobId: { type: Schema.Types.ObjectId, ref: "ImportJob", index: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const SalesRecord =
  mongoose.models.SalesRecord || mongoose.model<ISalesRecord>("SalesRecord", salesRecordSchema);
