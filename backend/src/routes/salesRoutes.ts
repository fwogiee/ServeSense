import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth";
import { ImportJob } from "../models/ImportJob";
import { MenuItem } from "../models/MenuItem";
import { SalesRecord } from "../models/SalesRecord";
import { asyncHandler } from "../utils/asyncHandler";
import { parseDateRange } from "../utils/dateRange";
import { ApiError } from "../utils/errors";
import { parseUploadedTable } from "../utils/fileParsers";
import { collapseSpaces, normalizeMenuItemName } from "../utils/normalize";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const manualSalesSchema = z.object({
  date: z.string(),
  menuItemName: z.string().min(1),
  qtySold: z.number().gt(0),
  revenue: z.number().min(0).optional(),
  channel: z.string().optional(),
});

const mappingSchema = z.object({
  date: z.string().min(1),
  menuItemName: z.string().min(1),
  qtySold: z.string().min(1),
  revenue: z.string().optional(),
  channel: z.string().optional(),
});

const parseBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  return fallback;
};

const parseMapping = (value: unknown): z.infer<typeof mappingSchema> => {
  if (!value) {
    throw new ApiError(400, "Column mapping is required for commit mode.");
  }
  let parsed: unknown;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch (_error) {
      throw new ApiError(400, "Invalid mapping payload JSON.");
    }
  } else {
    parsed = value;
  }
  return mappingSchema.parse(parsed);
};

const parseDate = (value: unknown): Date | null => {
  const normalized = typeof value === "string" ? value.trim() : String(value ?? "").trim();
  if (!normalized) {
    return null;
  }
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

router.use(authenticate, authorize("Admin", "Manager"));

router.post(
  "/import",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new ApiError(401, "Authentication required.");
    }
    if (!req.file) {
      throw new ApiError(400, "Upload a file under field name 'file'.");
    }

    const mode = req.body.mode === "commit" ? "commit" : "preview";
    const rows = parseUploadedTable(req.file);
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];

    if (mode === "preview") {
      res.json({
        mode,
        filename: req.file.originalname,
        rowCount: rows.length,
        headers,
        previewRows: rows.slice(0, 20),
      });
      return;
    }

    const mapping = parseMapping(req.body.mapping);
    const autoCreateMenuItems = parseBoolean(req.body.autoCreateMenuItems, false);
    const missingColumns = [mapping.date, mapping.menuItemName, mapping.qtySold].filter(
      (key) => !headers.includes(key)
    );

    if (missingColumns.length > 0) {
      throw new ApiError(400, `Missing mapped columns in file: ${missingColumns.join(", ")}`);
    }

    const errors: Array<{ row: number; message: string }> = [];
    const validRows: Array<{
      date: Date;
      menuItemName: string;
      normalizedMenuItemName: string;
      qtySold: number;
      revenue?: number;
      channel?: string;
    }> = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNumber = index + 2;

      const date = parseDate(row[mapping.date]);
      const menuItemRaw = collapseSpaces(String(row[mapping.menuItemName] ?? ""));
      const qtyRaw = String(row[mapping.qtySold] ?? "").trim();

      const qtySold = Number(qtyRaw);
      const revenueRaw = mapping.revenue ? String(row[mapping.revenue] ?? "").trim() : "";
      const revenue = revenueRaw ? Number(revenueRaw) : undefined;
      const channel = mapping.channel
        ? collapseSpaces(String(row[mapping.channel] ?? ""))
        : undefined;

      if (!date) {
        errors.push({ row: rowNumber, message: "Invalid date value." });
        continue;
      }
      if (!menuItemRaw) {
        errors.push({ row: rowNumber, message: "Menu item name is required." });
        continue;
      }
      if (!Number.isFinite(qtySold) || qtySold <= 0) {
        errors.push({ row: rowNumber, message: "qtySold must be a number greater than 0." });
        continue;
      }
      if (revenueRaw && (!Number.isFinite(revenue) || (revenue as number) < 0)) {
        errors.push({ row: rowNumber, message: "Revenue must be a non-negative number." });
        continue;
      }

      validRows.push({
        date,
        menuItemName: menuItemRaw,
        normalizedMenuItemName: normalizeMenuItemName(menuItemRaw),
        qtySold,
        revenue,
        channel: channel || undefined,
      });
    }

    const uniqueNormalizedNames = [...new Set(validRows.map((row) => row.normalizedMenuItemName))];
    const existingMenuItems = await MenuItem.find({
      normalizedName: { $in: uniqueNormalizedNames },
    }).lean();
    const menuItemByNormalized = new Map(
      existingMenuItems.map((item) => [item.normalizedName, item])
    );

    const missingNormalizedNames = uniqueNormalizedNames.filter(
      (name) => !menuItemByNormalized.has(name)
    );

    if (autoCreateMenuItems && missingNormalizedNames.length > 0) {
      const createPayload = missingNormalizedNames.map((normalizedName) => {
        const sourceRow = validRows.find((row) => row.normalizedMenuItemName === normalizedName);
        return {
          name: sourceRow ? sourceRow.menuItemName : normalizedName,
          normalizedName,
          isActive: true,
        };
      });

      if (createPayload.length > 0) {
        await MenuItem.insertMany(createPayload, { ordered: false });
      }

      const refreshedMenuItems = await MenuItem.find({
        normalizedName: { $in: uniqueNormalizedNames },
      }).lean();

      menuItemByNormalized.clear();
      for (const item of refreshedMenuItems) {
        menuItemByNormalized.set(item.normalizedName, item);
      }
    }

    const importJob = await ImportJob.create({
      filename: req.file.originalname,
      uploadedBy: req.user.id,
      rowCount: rows.length,
      errorCount: errors.length,
      errorsSample: errors.slice(0, 30),
    });

    const docs = validRows.map((row) => {
      const menuItem = menuItemByNormalized.get(row.normalizedMenuItemName);
      return {
        date: row.date,
        menuItemName: row.menuItemName,
        normalizedMenuItemName: row.normalizedMenuItemName,
        menuItemId: menuItem?._id,
        qtySold: row.qtySold,
        revenue: row.revenue,
        channel: row.channel,
        importJobId: importJob._id,
      };
    });

    if (docs.length > 0) {
      await SalesRecord.insertMany(docs);
    }

    const mappedCount = docs.filter((doc) => Boolean(doc.menuItemId)).length;

    res.status(201).json({
      mode,
      importJobId: importJob._id,
      filename: req.file.originalname,
      inserted: docs.length,
      mappedCount,
      unmappedCount: docs.length - mappedCount,
      errorCount: errors.length,
      errorsSample: errors.slice(0, 30),
      autoCreatedMenuItems: autoCreateMenuItems ? missingNormalizedNames.length : 0,
    });
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const fromRaw = typeof req.query.from === "string" ? req.query.from : undefined;
    const toRaw = typeof req.query.to === "string" ? req.query.to : undefined;
    const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;

    const filter: Record<string, unknown> = {};
    if (fromRaw || toRaw) {
      const range = parseDateRange(fromRaw, toRaw);
      filter.date = { $gte: range.from, $lte: range.to };
    }
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ menuItemName: regex }, { channel: regex }];
    }

    const records = await SalesRecord.find(filter).sort({ date: -1, _id: -1 }).limit(1000).lean();
    res.json({ items: records, total: records.length });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = manualSalesSchema.parse(req.body);
    const date = parseDate(payload.date);
    if (!date) {
      throw new ApiError(400, "Invalid date.");
    }

    const menuItemName = collapseSpaces(payload.menuItemName);
    const normalizedMenuItemName = normalizeMenuItemName(menuItemName);
    const menuItem = await MenuItem.findOne({ normalizedName: normalizedMenuItemName }).lean();

    const record = await SalesRecord.create({
      date,
      menuItemName,
      normalizedMenuItemName,
      menuItemId: menuItem?._id,
      qtySold: payload.qtySold,
      revenue: payload.revenue,
      channel: payload.channel,
    });

    res.status(201).json(record);
  })
);

export default router;
