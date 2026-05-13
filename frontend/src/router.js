import { bindAnalyticsPage, renderAnalyticsPage } from "./pages/analytics.js";
import {
  bindAnalyticsCategoryPage,
  renderAnalyticsCategoryPage,
} from "./pages/analyticsCategory.js";
import { bindBusinessDashboardPage, renderBusinessDashboardPage } from "./business/dashboard.js";
import { bindBusinessGeographyPage, renderBusinessGeographyPage } from "./business/geography.js";
import { bindBusinessForecastPage, renderBusinessForecastPage } from "./business/forecast.js";
import { renderCashbackPage } from "./pages/cashback.js";
import { bindHomePage, renderHomePage } from "./pages/home.js";
import { bindProductsPage, renderProductsPage } from "./pages/products.js";
import { bindProductPricePage, renderProductPricePage } from "./pages/productPrice.js";
import { renderProfilePage } from "./pages/profile.js";
import { bindReceiptSummaryPage, renderReceiptSummaryPage } from "./pages/receiptSummary.js";
import { bindReceiptsPage, renderReceiptsPage } from "./pages/receipts.js";

export const routes = {
  "/": {
    path: "/",
    navPath: "/",
    title: "Головна",
    render: renderHomePage,
    bind: bindHomePage,
  },
  "/receipts": {
    path: "/receipts",
    navPath: "/receipts",
    title: "Мої чеки",
    render: renderReceiptsPage,
    bind: bindReceiptsPage,
  },
  "/receipt-summary": {
    path: "/receipt-summary",
    navPath: "/receipts",
    backPath: "/receipts",
    title: "Підсумок чеку",
    render: renderReceiptSummaryPage,
    bind: bindReceiptSummaryPage,
  },
  "/products": {
    path: "/products",
    navPath: "/products",
    backPath: "/",
    title: "Продукти",
    render: renderProductsPage,
    bind: bindProductsPage,
  },
  "/product-price": {
    path: "/product-price",
    navPath: "/products",
    backPath: "/products",
    title: "Ціни на продукт",
    render: renderProductPricePage,
    bind: bindProductPricePage,
  },
  "/analytics": {
    path: "/analytics",
    navPath: "/analytics",
    title: "Аналітика покупок",
    render: renderAnalyticsPage,
    bind: bindAnalyticsPage,
  },
  "/analytics-category": {
    path: "/analytics-category",
    navPath: "/analytics",
    backPath: "/analytics",
    title: "Аналітика категорії",
    render: renderAnalyticsCategoryPage,
    bind: bindAnalyticsCategoryPage,
  },
  "/cashback": {
    path: "/cashback",
    navPath: "/",
    title: "Кешбек",
    render: renderCashbackPage,
  },
  "/profile": {
    path: "/profile",
    navPath: "/profile",
    title: "Профіль",
    render: renderProfilePage,
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
