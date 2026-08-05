import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface WishlistState {
  items: string[]; // store only product IDs as requested
}

const loadWishlist = (): string[] => {
  try {
    const saved = localStorage.getItem('wishlist');
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
};

const initialState: WishlistState = {
  items: loadWishlist(),
};

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState,
  reducers: {
    toggleWishlistItem: (state, action: PayloadAction<string>) => {
      const productId = action.payload;
      const index = state.items.indexOf(productId);
      if (index >= 0) {
        state.items.splice(index, 1);
      } else {
        state.items.push(productId);
      }
      localStorage.setItem('wishlist', JSON.stringify(state.items));
    },
  },
});

export const { toggleWishlistItem } = wishlistSlice.actions;
export default wishlistSlice.reducer;
