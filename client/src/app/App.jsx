// src/app/App.jsx
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import LoginPage from "../features/auth/pages/LoginPage.jsx";
import RegisterPage from "../features/auth/pages/RegisterPage.jsx";
import Layout from "../shared/components/Layout.jsx";
import DashboardGuard from "../shared/hooks/DashboardGuard.jsx";
import ProfilePage from "../features/auth/pages/ProfilePage.jsx";
import PersonsPage from "../features/people/pages/PersonPage.jsx";
import ProductPage from "../features/products/pages/ProductPage.jsx";
import BookstorePage from "../features/bookstore/BookstorePage.jsx";
import KioskPage from "../features/kiosk/KioskPage.jsx";
import { BookstoreProvider } from "../features/bookstore/BookstoreContext.jsx";
import LegacyBoundary from "../features/bookstore/LegacyBoundary.jsx";
import OrdersPage from "../features/orders/pages/OrdersPage.jsx";
import FinancialPage from "../features/financials/pages/FinancialPage.jsx";
import InvoicesPage from "../features/invoices/pages/InvoicePage.jsx";
import ExpensePage from "../features/financials/pages/ExpensePage.jsx";
import { useServerReady } from "../shared/utils/useServerReady.js";
import { Toaster } from "react-hot-toast";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/login" replace />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },
  { path: "/kiosk", element: <KioskPage /> },
  {
    element: <DashboardGuard />,
    children: [
      {
        element: <BookstoreProvider><Layout /></BookstoreProvider>,
        children: [
          { path: "/bookstore", element: <BookstorePage /> },
          {
            path: "/profile",
            element: <ProfilePage />,
          },
          {
            path: "/customers",
            element: <LegacyBoundary><PersonsPage readOnly /></LegacyBoundary>,
          },
          {
            path: "/customers/:id",
            element: <LegacyBoundary><PersonsPage readOnly /></LegacyBoundary>,
          },
          {
            path: "/orders",
            element: <LegacyBoundary><OrdersPage readOnly /></LegacyBoundary>,
          },
          {
            path: "/transactions",
            element: <LegacyBoundary><OrdersPage readOnly /></LegacyBoundary>,
          },
          {
            path: "/pos",
            element: <Navigate to="/bookstore" replace />,
          },
          {
            path: "/products",
            element: <LegacyBoundary><ProductPage readOnly /></LegacyBoundary>,
          },
          {
            path: "/finances",
            element: <LegacyBoundary><FinancialPage /></LegacyBoundary>,
          },
          {
            path: "/dashboard",
            element: <LegacyBoundary><FinancialPage /></LegacyBoundary>,
          },
          {
            path: "/invoices",
            element: <LegacyBoundary><InvoicesPage /></LegacyBoundary>,
          },
          {
            path: "/expenses",
            element: <LegacyBoundary><ExpensePage readOnly /></LegacyBoundary>,
          },
        ],
      },
    ],
  },
]);

export default function App() {
  // Keep the server health check running without blocking the login page.
  useServerReady();

  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="top-center" toastOptions={{ duration: 2800 }} />
    </>
  );
}
