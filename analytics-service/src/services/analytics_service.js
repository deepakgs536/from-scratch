import { getItem, putItem, incrementCounter, query } from "../repositories/analytics_repository.js";
import { getDefaultDashboard } from "../models/analytics_model.js";
import { logger } from "../utils/logger.js";
import {
  PK_DASHBOARD, SK_SUMMARY, PK_SALES, PK_PRODUCT, PK_INVENTORY, 
  PK_CUSTOMER, PK_PAYMENT, EVENT_TYPES
} from "../utils/constants.js";

export const getDashboard = async () => {
  const item = await getItem(PK_DASHBOARD, SK_SUMMARY);
  return item || getDefaultDashboard();
};

export const getRevenue = async () => await query(PK_SALES);
export const getOrders = async () => await getDashboard(); // Orders are in dashboard
export const getProducts = async () => await query(PK_PRODUCT);
export const getCustomers = async () => await query(PK_CUSTOMER);
export const getInventory = async () => await query(PK_INVENTORY);
export const getPayments = async () => await query(PK_PAYMENT);

const updateDashboardCounters = async (counters) => {
  await incrementCounter(PK_DASHBOARD, SK_SUMMARY, counters);
};

const updateSales = async (amount) => {
  const date = new Date();
  const dailySk = `DAILY#${date.toISOString().split('T')[0]}`;
  const monthlySk = `MONTHLY#${date.toISOString().substring(0, 7)}`;
  
  await incrementCounter(PK_SALES, dailySk, { revenue: amount });
  await incrementCounter(PK_SALES, monthlySk, { revenue: amount });
};

export const processEvent = async (eventType, payload) => {
  logger.info(`Processing event ${eventType}`);
  
  try {
    switch (eventType) {
      case EVENT_TYPES.ProductCreated:
        await updateDashboardCounters({ totalProducts: 1 });
        break;
      case EVENT_TYPES.ProductDeleted:
        await updateDashboardCounters({ totalProducts: -1 });
        break;
      case EVENT_TYPES.OrderCreated:
        await updateDashboardCounters({ totalOrders: 1, todayOrders: 1, pendingOrders: 1 });
        break;
      case EVENT_TYPES.OrderCancelled:
        await updateDashboardCounters({ pendingOrders: -1, cancelledOrders: 1 });
        break;
      case EVENT_TYPES.OrderCompleted:
        await updateDashboardCounters({ pendingOrders: -1, completedOrders: 1 });
        break;
      case EVENT_TYPES.PaymentSucceeded:
        const amount = Number(payload.amount || payload.total || 0);
        await updateDashboardCounters({ successfulPayments: 1, totalRevenue: amount, todayRevenue: amount });
        await updateSales(amount);
        break;
      case EVENT_TYPES.PaymentFailed:
        await updateDashboardCounters({ failedPayments: 1 });
        break;
      case EVENT_TYPES.UserRegistered:
        await updateDashboardCounters({ totalCustomers: 1 });
        const date = new Date().toISOString().split('T')[0];
        await incrementCounter(PK_CUSTOMER, `DAILY#${date}`, { count: 1 });
        break;
      case EVENT_TYPES.InventoryUpdated:
        const availableQuantity = Number(payload.available_quantity || 0);
        if (availableQuantity === 0) {
          await updateDashboardCounters({ outOfStockProducts: 1 });
        } else if (availableQuantity > 0 && availableQuantity <= 10) {
          // Using 10 as a default threshold for low stock
          await updateDashboardCounters({ lowStockProducts: 1 });
        }
        break;
      default:
        logger.debug(`Unhandled event type: ${eventType}`);
    }
  } catch (error) {
    logger.error(`Error processing event ${eventType}`, { error: error.message });
    throw error;
  }
};

export const generateDetailedReport = async () => {
  logger.info("Generating detailed report from all services via HTTP");

  const report = {
    generatedAt: new Date().toISOString(),
    users: {},
    products: {},
    orders: {},
    inventory: {},
    payments: {},
    trends: {
      revenueTrends: [],      // Daily revenue performance
      customerGrowth: [],     // New customers acquired over time
      topSellingProducts: [], // Products generating the most revenue
      inventoryStatus: []     // Current stock distribution
    }
  };

  // All service responses return { success: true, data: [...] }
  // Pass x-internal-key so protected endpoints (e.g. GET /users) allow us through
  const fetchServiceData = async (url) => {
    if (!url) return null;
    try {
      const response = await fetch(url, {
        headers: {
          'x-internal-key': process.env.INTERNAL_API_KEY || '',
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const json = await response.json();
        // Unwrap standard { success, data } envelope
        return Array.isArray(json) ? json : (json.data ?? null);
      }
      logger.warn(`Failed to fetch from ${url}: HTTP ${response.status}`);
      return null;
    } catch (error) {
      logger.error(`Error fetching from ${url}`, { error: error.message });
      return null;
    }
  };

  try {
    const [users, products, orders, inventory, payments] = await Promise.all([
      fetchServiceData(`${process.env.USER_SERVICE_URL}/users`),
      fetchServiceData(`${process.env.PRODUCT_SERVICE_URL}/products`),
      fetchServiceData(`${process.env.ORDER_SERVICE_URL}/orders`),
      fetchServiceData(`${process.env.INVENTORY_SERVICE_URL}/inventory`),
      fetchServiceData(`${process.env.PAYMENT_SERVICE_URL}/payments`)
    ]);

    // ── Users ──────────────────────────────────────────────────
    if (Array.isArray(users)) {
      report.users.total = users.length;
    }

    // ── Products ───────────────────────────────────────────────
    if (Array.isArray(products)) {
      report.products.total = products.length;
      const categories = {};
      products.forEach(p => {
        const cat = p.category || 'uncategorized';
        categories[cat] = (categories[cat] || 0) + 1;
      });
      report.products.byCategory = categories;
    }

    // ── Orders ─────────────────────────────────────────────────
    if (Array.isArray(orders)) {
      report.orders.total = orders.length;
      report.orders.totalRevenue = orders.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
      const statusCounts = {};
      orders.forEach(o => {
        const status = o.status || 'UNKNOWN';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      report.orders.byStatus = statusCounts;
    }

    // ── Inventory ──────────────────────────────────────────────
    if (Array.isArray(inventory)) {
      report.inventory.totalItems = inventory.length;
      let lowStock = 0;
      let outOfStock = 0;
      inventory.forEach(i => {
        const qty = Number(i.available_quantity || 0);
        if (qty === 0) outOfStock++;
        else if (qty <= 10) lowStock++;
      });
      report.inventory.lowStockItems = lowStock;
      report.inventory.outOfStockItems = outOfStock;
    }

    // ── Payments ───────────────────────────────────────────────
    if (Array.isArray(payments)) {
      report.payments.total = payments.length;
      let successful = 0;
      let failed = 0;
      let totalValue = 0;
      payments.forEach(p => {
        const status = (p.status || 'PENDING').toUpperCase();
        if (status === 'SUCCESS' || status === 'SUCCEEDED' || status === 'COMPLETED') {
          successful++;
          totalValue += Number(p.amount || 0);
        } else if (status === 'FAILED' || status === 'FAILURE') {
          failed++;
        }
      });
      report.payments.successfulCount = successful;
      report.payments.failedCount = failed;
      report.payments.totalSuccessfulValue = totalValue;
    }

    // ── TREND: Revenue Trends (daily revenue from orders) ──────
    if (Array.isArray(orders)) {
      const dailyRevenue = {};
      orders.forEach(o => {
        if (!o.created_at) return;
        const day = o.created_at.substring(0, 10); // "YYYY-MM-DD"
        dailyRevenue[day] = (dailyRevenue[day] || 0) + Number(o.total_amount || 0);
      });
      report.trends.revenueTrends = Object.entries(dailyRevenue)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, revenue]) => ({ date, revenue: Math.round(revenue * 100) / 100 }));
    }

    // ── TREND: Customer Growth (new users per day, cumulative) ─
    if (Array.isArray(users)) {
      const dailyNew = {};
      users.forEach(u => {
        if (!u.created_at) return;
        const day = u.created_at.substring(0, 10);
        dailyNew[day] = (dailyNew[day] || 0) + 1;
      });
      let cumulative = 0;
      report.trends.customerGrowth = Object.entries(dailyNew)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, newUsers]) => {
          cumulative += newUsers;
          return { date, newUsers, totalUsers: cumulative };
        });
    }

    // ── TREND: Top Selling Products (revenue per product) ──────
    if (Array.isArray(orders)) {
      const productRevenue = {};
      const productNames = {};

      // Build a product name lookup map from products data
      if (Array.isArray(products)) {
        products.forEach(p => {
          if (p.productId || p.id) {
            const pid = p.productId || p.id;
            productNames[pid] = p.name || p.title || pid;
          }
        });
      }

      orders.forEach(o => {
        if (!Array.isArray(o.items)) return;
        o.items.forEach(item => {
          const pid = item.productId || item.product_id || item.id;
          if (!pid) return;
          const price = Number(item.price || 0);
          const qty = Number(item.quantity || 1);
          productRevenue[pid] = (productRevenue[pid] || 0) + (price * qty);
          if (!productNames[pid] && (item.name || item.productName)) {
            productNames[pid] = item.name || item.productName;
          }
        });
      });

      report.trends.topSellingProducts = Object.entries(productRevenue)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([productId, revenue]) => ({
          productId,
          name: productNames[productId] || productId,
          revenue: Math.round(revenue * 100) / 100
        }));
    }

    // ── TREND: Inventory Status (stock level distribution) ─────
    if (Array.isArray(inventory)) {
      const statusGroups = { 'In Stock': 0, 'Low Stock': 0, 'Out of Stock': 0 };
      inventory.forEach(i => {
        const qty = Number(i.available_quantity || 0);
        if (qty === 0) statusGroups['Out of Stock']++;
        else if (qty <= 10) statusGroups['Low Stock']++;
        else statusGroups['In Stock']++;
      });
      report.trends.inventoryStatus = Object.entries(statusGroups)
        .map(([status, count]) => ({ status, count }));
    }

  } catch (error) {
    logger.error("Error generating detailed report", { error: error.message });
  }

  return report;
};
