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
