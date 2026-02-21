# ServeSense (V1)

ServeSense is a production-ready V1 restaurant inventory tracker built for clean operations today and AI forecasting extensibility in V2.

## Tech Stack
- Frontend: React + Vite + TypeScript + React Router
- Backend: Node.js + Express + TypeScript
- Database: MongoDB + Mongoose
- Auth: JWT + bcrypt

## Build Plan Implemented
1. Scaffold split architecture: `backend` API + `frontend` SPA + `samples`.
2. Implement foundational backend layers:
   - Config, DB bootstrap, middleware, models, services, routes.
   - Role-based auth and protected endpoints.
3. Implement V1 domain workflows:
   - Ingredients CRUD + stock adjustments + audit logs.
   - Menu items + recipe/BOM mapping with unit enforcement.
   - CSV/XLSX sales import with preview, column mapping, validation, normalization.
   - Deterministic usage/depletion computation from actual sales + recipes.
   - Reorder worksheet generation, editable final quantities, saved reorder plans, CSV export.
4. Implement V2 hooks:
   - Forecasting provider interface + stub provider.
   - Placeholder forecast collections.
5. Build frontend UX:
   - Auth, protected navigation, operational pages, empty states, guided prompts.
6. Verify:
   - `npm run build` passes in both backend and frontend.

## Folder Structure
```text
.
├── backend
│   ├── src
│   │   ├── app.ts
│   │   ├── server.ts
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── services/
│   │   │   └── forecasting/
│   │   ├── types/
│   │   └── utils/
│   └── .env.example
├── frontend
│   ├── src
│   │   ├── api/
│   │   ├── auth/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── styles.css
│   └── .env.example
└── samples
    ├── sales-sample.csv
    └── sales-template-xlsx.md
```

## V1 Features

### Auth
- Register/Login
- Roles: `Admin`, `Manager`
- Protected routes + JWT bearer auth

### Ingredients
- Full CRUD
- Search + low-stock filtering/highlight
- Stock adjustment endpoint with reason + audit log

### Menu Items + Recipes (BOM)
- Full CRUD for menu items
- Recipe editor (`menuItem -> ingredient lines`)
- Unit validation: recipe line unit must match ingredient unit
- Unmapped sales menu items endpoint

### Sales Import
- Upload CSV/XLSX
- Preview first 20 rows
- Column mapping UI fields: `date`, `menuItemName`, `qtySold`, `revenue?`, `channel?`
- Validation with row-level errors
- Menu item name normalization (trim + collapse spaces + lowercase key)
- Optional auto-create menu items during commit
- Sales browser with date/search filters

### Usage (Deterministic, No Forecasting)
- Usage computed from `qtySold * recipe ingredient qty`
- Aggregated ingredient usage report
- Estimated ingredient cost and top contributing menu items
- Optional stock-impact projection view
- Usage hard-blocks if sales menu items are unmapped or missing recipes

### Reorder Worksheet (Manual, Non-AI)
- Recommended quantity: `max(0, parLevel - currentStock)`
- Conversion-aware reorder unit rounding (when conversion factor exists)
- Editable final quantities
- Estimated cost per line + total
- Save reorder plans and export CSV

### V2 Readiness Hooks
- `services/forecasting/ForecastingProvider.ts` interface
- `services/forecasting/StubForecastingProvider.ts` implementation (`not_implemented`)
- Placeholder models:
  - `MenuForecast`
  - `IngredientForecast`

## API Endpoints (Implemented)

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Ingredients
- `GET /api/ingredients`
- `POST /api/ingredients`
- `PUT /api/ingredients/:id`
- `DELETE /api/ingredients/:id`
- `POST /api/ingredients/:id/adjust`
- `GET /api/ingredients/:id/adjustments`

### Menu Items + Recipes
- `GET /api/menu-items`
- `POST /api/menu-items`
- `PUT /api/menu-items/:id`
- `DELETE /api/menu-items/:id`
- `GET /api/menu-items/:id/recipe`
- `PUT /api/menu-items/:id/recipe`
- `GET /api/menu-items/unmapped`

### Sales
- `POST /api/sales/import` (multipart)
- `GET /api/sales`
- `POST /api/sales`

### Usage + Reorder
- `GET /api/usage/ingredients`
- `GET /api/reorder-plans/worksheet`
- `POST /api/reorder-plans`
- `GET /api/reorder-plans`
- `GET /api/reorder-plans/:id/export.csv`

## Local Setup

## 1) Prerequisites
- Node.js 20+
- MongoDB running locally (default: `mongodb://127.0.0.1:27017/servesense`)

## 2) Backend
```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Backend default URL: `http://localhost:4000`

## 3) Frontend
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend URL: `http://localhost:5173`

## 4) Sample Import Data
- CSV sample: `samples/sales-sample.csv`
- XLSX template spec: `samples/sales-template-xlsx.md`

Optional root helper build:
```bash
npm run build
```

## How To Use (Quick Start)
1. Register an account.
2. Add ingredients with stock/par/cost.
3. Add menu items.
4. Map recipes for each sold menu item.
5. Import sales via CSV/XLSX (`Sales Import` page).
6. Open `Usage` page and run date-range usage.
7. Open `Reorder` page, edit final quantities, save plan, export CSV.

## Build Verification
- Backend: `cd backend && npm run build` (passes)
- Frontend: `cd frontend && npm run build` (passes)
