import { configureStore, createSlice } from '@reduxjs/toolkit';

import authReducer from './slices/authSlice';
import cartReducer from './slices/cartSlice';
import wishlistReducer from './slices/wishlistSlice';

// Temporary dummy slices until Step 9-13
const productsSlice = createSlice({ name: 'products', initialState: {}, reducers: {} });
const ordersSlice = createSlice({ name: 'orders', initialState: {}, reducers: {} });
const paymentsSlice = createSlice({ name: 'payments', initialState: {}, reducers: {} });
const themeSlice = createSlice({ name: 'theme', initialState: { mode: 'dark' }, reducers: {} });
const uiSlice = createSlice({ name: 'ui', initialState: {}, reducers: {} });

export const store = configureStore({
  reducer: {
    products: productsSlice.reducer,
    cart: cartReducer,
    wishlist: wishlistReducer,
    orders: ordersSlice.reducer,
    payments: paymentsSlice.reducer,
    auth: authReducer,
    theme: themeSlice.reducer,
    ui: uiSlice.reducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
