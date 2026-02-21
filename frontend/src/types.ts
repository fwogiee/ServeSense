export type UserRole = "Admin" | "Manager";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export interface Ingredient {
  _id: string;
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
  updatedAt: string;
  lowStock?: boolean;
}

export interface MenuItem {
  _id: string;
  name: string;
  category?: string;
  isActive: boolean;
  normalizedName: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeLine {
  _id?: string;
  ingredientId:
    | string
    | {
        _id: string;
        name: string;
        unit: string;
      };
  qtyPerMenuItem: number;
  unit: string;
}

export interface SalesRecord {
  _id: string;
  date: string;
  menuItemName: string;
  menuItemId?: string;
  qtySold: number;
  revenue?: number;
  channel?: string;
}
