import { axiosClient } from './axiosClient';
import { mockProducts, mockCart, mockOrders, mockInventory, mockPayments } from './mockData';

// Helper to check if mock is enabled
const useMock = import.meta.env.VITE_USE_MOCK_DATA === 'true';

const mockResponse = <T>(data: T, delay = 500): Promise<{ data: T }> => {
  return new Promise((resolve) => {
    setTimeout(() => resolve({ data }), delay);
  });
};

// --- PRODUCT SERVICE ---
export const ProductAPI = {
  getAll: async (category?: string) => {
    if (useMock) return mockResponse({ success: true, data: mockProducts });
    const params = category && category !== 'All Categories' ? { category } : undefined;
    return axiosClient.get('/products', { params });
  },
  getById: async (id: string, suppressError = false) => {
    if (useMock) return mockResponse({ success: true, data: mockProducts.find(p => p.productId === id) });
    return axiosClient.get(`/products/${id}`, { suppressError } as any);
  },
  create: async (data: any) => {
    if (useMock) return mockResponse({ success: true, data: { ...data, productId: `p_${Date.now()}` } });
    return axiosClient.post('/products', data);
  },
  update: async (id: string, data: any) => {
    if (useMock) return mockResponse({ success: true, message: 'Updated', data });
    return axiosClient.put(`/products/${id}`, data);
  },
  delete: async (id: string) => {
    if (useMock) return mockResponse({ success: true, message: 'Deleted' });
    return axiosClient.delete(`/products/${id}`);
  }
};

// --- CART SERVICE ---
export const CartAPI = {
  get: async (userId: string) => {
    if (useMock) return mockResponse({ success: true, data: mockCart });
    return axiosClient.get(`/cart/${userId}`);
  },
  addItem: async (userId: string, data: any) => {
    if (useMock) return mockResponse({ success: true, data: { ...mockCart, items: [...mockCart.items, data] } });
    return axiosClient.post(`/cart/${userId}/items`, data);
  },
  updateItem: async (userId: string, itemId: string, data: any) => {
    if (useMock) return mockResponse({ success: true, data: mockCart });
    return axiosClient.put(`/cart/${userId}/items/${itemId}`, data);
  },
  removeItem: async (userId: string, itemId: string) => {
    if (useMock) return mockResponse({ success: true, data: mockCart });
    return axiosClient.delete(`/cart/${userId}/items/${itemId}`);
  },
  clear: async (userId: string) => {
    if (useMock) return mockResponse({ success: true, message: 'Cleared' });
    return axiosClient.delete(`/cart/${userId}`);
  },
  checkout: async (userId: string) => {
    if (useMock) return mockResponse({ success: true, message: 'Checkout initiated', data: mockCart });
    return axiosClient.post(`/cart/${userId}/checkout`);
  }
};

// --- ORDER SERVICE ---
export const OrderAPI = {
  create: async (data: any) => {
    if (useMock) return mockResponse({ success: true, data: { ...mockOrders[0], ...data } });
    return axiosClient.post('/orders', data);
  },
  getById: async (id: string) => {
    if (useMock) return mockResponse({ success: true, data: mockOrders.find(o => o.orderId === id) });
    return axiosClient.get(`/orders/${id}`);
  },
  getUserOrders: async (userId: string) => {
    if (useMock) return mockResponse({ success: true, data: mockOrders.filter(o => o.userId === userId) });
    return axiosClient.get(`/orders/user/${userId}`);
  },
  getAllOrders: async () => {
    if (useMock) return mockResponse({ success: true, data: mockOrders });
    return axiosClient.get('/orders');
  },
  updateOrderStatus: async (id: string, status: string) => {
    if (useMock) return mockResponse({ success: true, message: 'Status updated' });
    return axiosClient.put(`/orders/${id}/status`, { status });
  },
  updateOrder: async (id: string, data: any) => {
    if (useMock) return mockResponse({ success: true, message: 'Order updated', data });
    return axiosClient.put(`/orders/${id}`, data);
  }
};

// --- PAYMENT SERVICE ---
export const PaymentAPI = {
  getAll: async () => {
    if (useMock) return mockResponse({ success: true, count: mockPayments.length, data: mockPayments });
    return axiosClient.get('/payments');
  },
  process: async (data: { orderId: string; amount: number; method: string }) => {
    if (useMock) return mockResponse({ success: true, message: 'Payment successful', transactionId: `txn_${Date.now()}` });
    return axiosClient.post('/payments/process', data);
  },
  getByOrderId: async (orderId: string) => {
    if (useMock) return mockResponse({ success: true, data: { paymentId: `pay_${Date.now()}`, orderId, status: 'PENDING' } });
    return axiosClient.get(`/payments/order/${orderId}`);
  },
  update: async (paymentId: string, data: any) => {
    if (useMock) return mockResponse({ success: true, message: 'Payment updated', data });
    return axiosClient.put(`/payments/${paymentId}`, data);
  }
};

// --- INVENTORY SERVICE ---
export const InventoryAPI = {
  getAll: async () => {
    if (useMock) return mockResponse({ success: true, count: mockInventory.length, data: mockInventory });
    return axiosClient.get('/inventory');
  },
  getByProductId: async (productId: string) => {
    if (useMock) {
      const inv = mockInventory.find(i => i.productId === productId);
      return mockResponse({ success: true, data: inv });
    }
    return axiosClient.get(`/inventory/${productId}`);
  },
  update: async (productId: string, data: any) => {
    if (useMock) return mockResponse({ success: true, data });
    return axiosClient.put(`/inventory/${productId}`, data);
  }
};

// --- USER SERVICE ---
export const UserAPI = {
  getProfile: async (userId: string, suppressError = false) => {
    if (useMock) return mockResponse({ success: true, data: { userId, name: 'Admin User', email: 'admin@example.com', role: 'admin', profile_image_url: '' } });
    return axiosClient.get(`/users/${userId}`, { suppressError } as any);
  },
  updateProfile: async (userId: string, data: any) => {
    if (useMock) return mockResponse({ success: true, message: 'Profile updated successfully', data });
    return axiosClient.put(`/users/${userId}`, data);
  }
};

// --- MEDIA SERVICE ---
export const MediaAPI = {
  getUploadUrl: async (data: { folder: string; fileName: string; contentType: string }) => {
    console.log('[MediaAPI] Requesting upload URL for:', data);
    if (useMock) {
      console.log('[MediaAPI] using mock response for upload URL');
      return mockResponse({
        success: true,
        uploadUrl: 'https://mock-s3-url.com/upload-here',
        key: `${data.folder}/${Date.now()}_${data.fileName}`
      });
    }
    return axiosClient.post('/media/upload-url', data);
  },
  uploadToS3: async (uploadUrl: string, file: File) => {
    console.log('[MediaAPI] Starting direct S3 upload to:', uploadUrl);
    const response = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
            "Content-Type": file.type
        }
    });

    if (!response.ok) {
        console.error('[MediaAPI] S3 Upload failed. Status:', response.status);
        console.log(await response.text());
        throw new Error("Upload failed");
    }

    console.log('[MediaAPI] S3 Upload successful! Status:', response.status);
    return response;
  },
  getDownloadUrl: async (key: string) => {
    return axiosClient.get("/media/download-url", {
      params: { key }
    });
  }
};

// --- ANALYTICS SERVICE ---
export const AnalyticsAPI = {
  getHealth: async () => {
    return axiosClient.get('/analytics/health');
  },
  getDashboardSummary: async () => {
    return axiosClient.get('/analytics/dashboard');
  },
  getRevenueAnalytics: async () => {
    return axiosClient.get('/analytics/revenue');
  },
  getOrderAnalytics: async () => {
    return axiosClient.get('/analytics/orders');
  },
  getProductAnalytics: async () => {
    return axiosClient.get('/analytics/products');
  },
  getCustomerAnalytics: async () => {
    return axiosClient.get('/analytics/customers');
  },
  getInventoryAnalytics: async () => {
    return axiosClient.get('/analytics/inventory');
  },
  getPaymentAnalytics: async () => {
    return axiosClient.get('/analytics/payments');
  },
  getGeneratedReport: async () => {
    return axiosClient.get('/generate/report');
  }
};
