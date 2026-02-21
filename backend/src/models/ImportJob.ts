import mongoose, { Document, Schema, Types } from "mongoose";

interface ImportErrorLine {
  row: number;
  message: string;
}

export interface IImportJob extends Document {
  filename: string;
  uploadedBy: Types.ObjectId;
  uploadedAt: Date;
  rowCount: number;
  errorCount: number;
  errorsSample: ImportErrorLine[];
}

const importErrorSchema = new Schema<ImportErrorLine>(
  {
    row: { type: Number, required: true },
    message: { type: String, required: true },
  },
  { _id: false }
);

const importJobSchema = new Schema<IImportJob>(
  {
    filename: { type: String, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    uploadedAt: { type: Date, default: Date.now },
    rowCount: { type: Number, required: true },
    errorCount: { type: Number, required: true, default: 0 },
    errorsSample: { type: [importErrorSchema], default: [] },
  },
  { versionKey: false }
);

export const ImportJob =
  mongoose.models.ImportJob || mongoose.model<IImportJob>("ImportJob", importJobSchema);
