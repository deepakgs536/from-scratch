import { useState, useEffect } from 'react';
import { MediaAPI } from '@/api/services';

export const CartItemImage = ({ item, className }: { item: any; className?: string }) => {
  const [imageUrl, setImageUrl] = useState<string>('');

  useEffect(() => {
    let isMounted = true;
    const fetchFreshUrl = async () => {
      try {
        let key = item.image_url;
        // Extract original key if it's an expired presigned URL
        if (key && key.startsWith('http') && key.includes('amazonaws.com')) {
          const parsed = new URL(key);
          key = parsed.pathname.substring(1);
        }

        if (key) {
          const res = await MediaAPI.getDownloadUrl(key);
          if (isMounted) {
            setImageUrl(res.data.url);
          }
        }
      } catch (err) {
        console.error("Failed to fetch fresh image url", err);
      }
    };

    if (item.image_url) {
      setImageUrl(item.image_url);
      fetchFreshUrl();
    }
    
    return () => { isMounted = false; };
  }, [item.image_url]);

  return (
    <img 
      src={imageUrl || 'https://images.unsplash.com/photo-1560393464-5c69a73c5770?w=500&q=80'} 
      alt={item.name || 'Product Image'} 
      className={className || "w-full h-full object-cover"}
    />
  );
};
