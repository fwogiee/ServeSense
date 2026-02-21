import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Ingredient, MenuItem, SalesRecord } from "../types";

const DashboardPage = () => {
  const { token } = useAuth();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [sales, setSales] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!token) {
        return;
      }
      setLoading(true);
      try {
        const [ingredientData, menuItemData, salesData] = await Promise.all([
          apiRequest<{ items: Ingredient[] }>("/ingredients", { token }),
          apiRequest<{ items: MenuItem[] }>("/menu-items", { token }),
          apiRequest<{ items: SalesRecord[] }>("/sales", { token }),
        ]);
        setIngredients(ingredientData.items);
        setMenuItems(menuItemData.items);
        setSales(salesData.items);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [token]);

  const lowStockCount = useMemo(
    () =>
      ingredients.filter((ingredient) => {
        const threshold = ingredient.reorderPoint ?? ingredient.parLevel;
        return ingredient.currentStock <= threshold;
      }).length,
    [ingredients]
  );

  if (loading) {
    return <div className="centered-state">Loading dashboard...</div>;
  }

  const cards = [
    { label: "Ingredients", value: ingredients.length, hint: "Tracked stock entries" },
    { label: "Menu Items", value: menuItems.length, hint: "Active + inactive menu items" },
    { label: "Sales Rows", value: sales.length, hint: "Most recent 1000 records" },
    { label: "Low Stock", value: lowStockCount, hint: "At or below threshold" },
  ];

  return (
    <section className="stack-section">
      <div className="stat-grid">
        {cards.map((card) => (
          <article key={card.label} className="stat-card">
            <p>{card.label}</p>
            <h3>{card.value}</h3>
            <span>{card.hint}</span>
          </article>
        ))}
      </div>

      {sales.length === 0 ? (
        <div className="empty-state">
          <h3>Import sales to get started</h3>
          <p>Usage and depletion reports require actual sales records and recipe mappings.</p>
          <Link className="primary-btn inline-btn" to="/sales-import">
            Go to Sales Import
          </Link>
        </div>
      ) : null}

      {menuItems.length > 0 && ingredients.length > 0 ? null : (
        <div className="empty-state">
          <h3>Build your operational baseline</h3>
          <p>
            Add ingredients and menu items, then map recipes so deterministic ingredient usage can run.
          </p>
        </div>
      )}
    </section>
  );
};

export default DashboardPage;
