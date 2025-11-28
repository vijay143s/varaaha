import { createBrowserRouter } from "react-router-dom";

import { AppLayout } from "../layouts/app-layout";
import { LandingPage } from "../pages/landing-page";
import { ProductsPage } from "../pages/products-page";
import { SignInPage } from "../pages/sign-in-page";
import { SignUpPage } from "../pages/sign-up-page";
import { DashboardPage } from "../pages/dashboard-page";
import { OrdersPage } from "../pages/orders-page";
import { CartPage } from "../pages/cart-page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <LandingPage />
      },
      {
        path: "products",
        element: <ProductsPage />
      },
      {
        path: "signin",
        element: <SignInPage />
      },
      {
        path: "signup",
        element: <SignUpPage />
      },
      {
        path: "account",
        element: <DashboardPage />
      },
      {
        path: "orders",
        element: <OrdersPage />
      },
      {
        path: "cart",
        element: <CartPage />
      }
    ]
  }
]);
