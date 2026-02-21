import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/ingredients", label: "Ingredients" },
  { to: "/menu-items", label: "Menu Items" },
  { to: "/sales-import", label: "Sales Import" },
  { to: "/usage", label: "Usage" },
  { to: "/reorder", label: "Reorder" },
];

const Layout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="brand-kicker">ServeSense</p>
          <h1 className="brand-title">Restaurant Inventory Tracker</h1>
        </div>
        <div className="account-panel">
          <p>{user?.email}</p>
          <span>{user?.role}</span>
          <button className="ghost-btn" onClick={handleLogout} type="button">
            Logout
          </button>
        </div>
      </header>

      <nav className="tab-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => (isActive ? "tab-link active" : "tab-link")}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main className="page-body">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
