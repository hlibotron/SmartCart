import { bindAnalyticsPage, renderAnalyticsPage } from "./pages/analytics.js";
import {
  bindAnalyticsCategoryPage,
  renderAnalyticsCategoryPage,
} from "./pages/analyticsCategory.js";
import { bindBusinessDashboardPage, renderBusinessDashboardPage } from "./business/dashboard.js";
import { bindBusinessGeographyPage, renderBusinessGeographyPage } from "./business/geography.js";
import { bindBusinessForecastPage, renderBusinessForecastPage } from "./business/forecast.js";
import { bindCashbackPage, renderCashbackPage } from "./pages/cashback.js";
import { bindAuthPage, renderLoginPage, renderRegisterPage } from "./pages/auth.js";
import { bindHomePage, renderHomePage } from "./pages/home.js";
import {
  bindOnboardingPage,
  renderOnboardingPage,
} from "./pages/onboarding/onboardingPage.js";
import { bindProductsPage, renderProductsPage } from "./pages/products.js";
import { bindProductPricePage, renderProductPricePage } from "./pages/productPrice.js";
import { bindProfilePage, renderProfilePage } from "./pages/profile.js";
import { bindReceiptSummaryPage, renderReceiptSummaryPage } from "./pages/receiptSummary.js";
import { bindReceiptsPage, renderReceiptsPage } from "./pages/receipts.js";
import { bindStoreMapPage, renderStoreMapPage } from "./pages/storeMap.js";

export const routes = {
  "/": {
    path: "/",
    navPath: "/",
    title: "Головна",
    requiresAuth: true,
    render: renderHomePage,
    bind: bindHomePage,
  },
  "/receipts": {
    path: "/receipts",
    navPath: "/receipts",
    title: "Мої чеки",
    requiresAuth: true,
    render: renderReceiptsPage,
    bind: bindReceiptsPage,
  },
  "/receipt-summary": {
    path: "/receipt-summary",
    navPath: "/receipts",
    backPath: "/receipts",
    title: "Підсумок чеку",
    requiresAuth: true,
    render: renderReceiptSummaryPage,
    bind: bindReceiptSummaryPage,
  },
  "/products": {
    path: "/products",
    navPath: "/products",
    backPath: "/",
    title: "Продукти",
    requiresAuth: true,
    render: renderProductsPage,
    bind: bindProductsPage,
  },
  "/product-price": {
    path: "/product-price",
    navPath: "/products",
    backPath: "/products",
    title: "Ціни на продукт",
    requiresAuth: true,
    render: renderProductPricePage,
    bind: bindProductPricePage,
  },
  "/stores-map": {
    path: "/stores-map",
    navPath: "/products",
    backPath: "/product-price",
    title: "Ціни в магазинах",
    requiresAuth: true,
    render: renderStoreMapPage,
    bind: bindStoreMapPage,
  },
  "/analytics": {
    path: "/analytics",
    navPath: "/analytics",
    title: "Аналітика покупок",
    requiresAuth: true,
    render: renderAnalyticsPage,
    bind: bindAnalyticsPage,
  },
  "/analytics-category": {
    path: "/analytics-category",
    navPath: "/analytics",
    backPath: "/analytics",
    title: "Аналітика категорії",
    requiresAuth: true,
    render: renderAnalyticsCategoryPage,
    bind: bindAnalyticsCategoryPage,
  },
  "/cashback": {
    path: "/cashback",
    navPath: "/",
    title: "Керування кешбеком",
    requiresAuth: true,
    render: renderCashbackPage,
    bind: bindCashbackPage,
  },
  "/profile/payout": {
    path: "/profile/payout",
    navPath: "/profile",
    backPath: "/cashback",
    title: "Спосіб виплати",
    requiresAuth: true,
    render: renderProfilePage,
    bind: bindProfilePage,
  },
  "/profile": {
    path: "/profile",
    navPath: "/profile",
    title: "Профіль",
    requiresAuth: true,
    render: renderProfilePage,
    bind: bindProfilePage,
  },
  "/login": {
    path: "/login",
    layout: "onboarding",
    title: "Вхід",
    authOnly: true,
    render: renderLoginPage,
    bind: bindAuthPage,
  },
  "/register": {
    path: "/register",
    layout: "onboarding",
    title: "Реєстрація",
    authOnly: true,
    render: renderRegisterPage,
    bind: bindAuthPage,
  },
  "/onboarding": {
    path: "/onboarding",
    layout: "onboarding",
    title: "Вступ",
    render: renderOnboardingPage,
    bind: bindOnboardingPage,
  },
  "/business": {
    path: "/business",
    layout: "business",
    title: "Огляд бізнесу",
    render: renderBusinessDashboardPage,
    bind: bindBusinessDashboardPage,
  },
  "/business/overview": {
    path: "/business/overview",
    layout: "business",
    title: "Огляд бізнесу",
    render: renderBusinessDashboardPage,
    bind: bindBusinessDashboardPage,
  },
  "/business/geography": {
    path: "/business/geography",
    layout: "business",
    title: "Географія та пікові години",
    render: renderBusinessGeographyPage,
    bind: bindBusinessGeographyPage,
  },
  "/business/forecast": {
    path: "/business/forecast",
    layout: "business",
    title: "Прогноз та еластичність",
    render: renderBusinessForecastPage,
    bind: bindBusinessForecastPage,
  },
};
