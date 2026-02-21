import path from "node:path";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";
import { ApiError } from "./errors";

export type ParsedRow = Record<string, unknown>;

const parseCsvBuffer = (buffer: Buffer): ParsedRow[] => {
  const csv = buffer.toString("utf8");
  const records = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as ParsedRow[];
  return records;
};

const parseXlsxBuffer = (buffer: Buffer): ParsedRow[] => {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return [];
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<ParsedRow>(sheet, {
    defval: "",
    raw: false,
  });
  return rows;
};

export const parseUploadedTable = (file: Express.Multer.File): ParsedRow[] => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === ".csv") {
    return parseCsvBuffer(file.buffer);
  }
  if (ext === ".xlsx" || ext === ".xls") {
    return parseXlsxBuffer(file.buffer);
  }
  throw new ApiError(400, "Unsupported file format. Upload CSV or XLSX.");
};
