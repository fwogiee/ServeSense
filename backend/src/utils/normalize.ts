export const collapseSpaces = (value: string): string =>
  value.replace(/\s+/g, " ").trim();

export const normalizeMenuItemName = (value: string): string =>
  collapseSpaces(value).toLowerCase();
