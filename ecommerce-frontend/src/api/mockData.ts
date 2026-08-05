export const mockProducts = [
  {
    productId: "p_1",
    name: "Premium Wireless Headphones",
    description: "High-quality noise-canceling wireless headphones.",
    price: 299,
    sku: "WH-1000XM4",
    category: "Electronics",
    image_url: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80",
    stock_status: "IN_STOCK",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    productId: "p_2",
    name: "Minimalist Mechanical Keyboard",
    description: "Compact 75% layout with tactile switches.",
    price: 149,
    sku: "KBD-75",
    category: "Accessories",
    image_url: "https://images.unsplash.com/photo-1595225476474-87563907a212?w=500&q=80",
    stock_status: "IN_STOCK",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    productId: "p_3",
    name: "Ergonomic Office Chair",
    description: "Adjustable lumbar support and breathable mesh.",
    price: 499,
    sku: "CHR-ERGO",
    category: "Furniture",
    image_url: "https://images.unsplash.com/photo-1505843490538-5133c6c7d0e1?w=500&q=80",
    stock_status: "IN_STOCK",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

export const mockCart = {
  userId: "u_1",
  items: [
    {
      productId: "p_1",
      quantity: 1,
      price_at_addition: 299
    }
  ],
  total_price: 299
};

export const mockOrders = [
  {
    orderId: "o_1",
    userId: "u_1",
    status: "PAID",
    total_amount: 299,
    shipping_address: {
      street: "123 Main St",
      city: "Tech City",
      state: "CA",
      zip: "94000"
    },
    items: [
      {
        productId: "p_1",
        quantity: 1,
        price: 299
      }
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

export const mockInventory = [
  {
    productId: "p_1",
    available_quantity: 10,
    reserved_quantity: 0,
    updated_at: new Date().toISOString(),
  },
  {
    productId: "p_2",
    available_quantity: 100,
    reserved_quantity: 5,
    updated_at: new Date().toISOString(),
  },
  {
    productId: "p_3",
    available_quantity: 0,
    reserved_quantity: 0,
    updated_at: new Date().toISOString(),
  }
];

export const mockPayments = [
  {
    updated_at: new Date().toISOString(),
    paymentId: "pay_auto_a2f3cc1bb8714b2ba2d534994f8d09dd",
    currency: "USD",
    created_at: new Date().toISOString(),
    payment_method: "CARD",
    orderId: "a2f3cc1b-b871-4b2b-a2d5-34994f8d09dd",
    userId: "user123",
    status: "PENDING",
    amount: 5998,
    transaction_id: "mock_txn_3d561556"
  },
  {
    updated_at: new Date().toISOString(),
    paymentId: "pay_auto_b9c24483a123f4b",
    currency: "USD",
    created_at: new Date(Date.now() - 86400000).toISOString(),
    payment_method: "PAYPAL",
    orderId: "o_1",
    userId: "u_1",
    status: "COMPLETED",
    amount: 299,
    transaction_id: "mock_txn_999123"
  }
];
