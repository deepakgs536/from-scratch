import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate } from 'react-router-dom';
import { ProductAPI, MediaAPI } from '@/api/services';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Package, ArrowLeft, Loader2, UploadCloud, File as FileIcon, CheckCircle2 } from 'lucide-react';

const productSchema = z.object({
  name: z.string().min(2, 'Name is required (min 2 chars)'),
  price: z.coerce.number().positive("Price must be a positive number").max(100000, "Price seems too high").optional(),
  description: z.string().optional(),
  sku: z.string().optional(),
  category: z.string().optional(),
  image_url: z.string().optional(),
});

type ProductFormValues = z.infer<typeof productSchema>;

export const CreateProduct = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');

  const navigate = useNavigate();
  
  const { register, handleSubmit, formState: { errors } } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema) as any,
    defaultValues: {
      name: '',
      price: 0,
      description: '',
      sku: '',
      category: '',
      image_url: '',
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      
      if (!validTypes.includes(file.type)) {
        toast.error('Invalid file type. Only JPEG, PNG, and WebP are allowed.');
        setSelectedFile(null);
        e.target.value = '';
        return;
      }
      
      setSelectedFile(file);
      setUploadStatus('idle');
    }
  };

  const onSubmit = async (data: ProductFormValues) => {
    console.log('[CreateProduct] onSubmit triggered with form data:', data);
    setIsSubmitting(true);
    let finalImageUrl = data.image_url || '';

    try {
      if (selectedFile) {
        console.log('[CreateProduct] File selected for upload:', selectedFile.name, selectedFile.type, selectedFile.size);
        setUploadStatus('uploading');

        // 1. Get pre-signed URL
        console.log('[CreateProduct] Fetching pre-signed upload URL...');
        const uploadUrlResponse = await MediaAPI.getUploadUrl({
          folder: 'products',
          fileName: selectedFile.name,
          contentType: selectedFile.type,
        });

        const resData = uploadUrlResponse.data.data || uploadUrlResponse.data;
        const { uploadUrl, key } = resData;
        console.log('[CreateProduct] Received pre-signed URL. Key:', key);

        if (!uploadUrl) {
          console.error('[CreateProduct] Error: No upload URL returned from API');
          throw new Error('No upload URL returned');
        }

        // 2. Upload directly to S3
        console.log('[CreateProduct] Initiating direct upload to S3...');
        await MediaAPI.uploadToS3(uploadUrl, selectedFile);

        console.log('[CreateProduct] S3 upload successful!');
        setUploadStatus('success');
        // Construct a mock public URL or use the key depending on how the frontend displays it
        // Our mock uses URL directly in ProductCard, so let's mock a public URL here based on the key
        finalImageUrl = key;
        console.log('[CreateProduct] Final image URL set to:', finalImageUrl);
      } else {
        console.log('[CreateProduct] No file selected, skipping upload step.');
      }

      const productPayload = {
        ...data,
        image_url: finalImageUrl,
      };

      console.log('[CreateProduct] Sending final product payload to API:', productPayload);
      await ProductAPI.create(productPayload);
      console.log('[CreateProduct] Product created successfully via API!');
      toast.success('Product created successfully');
      navigate('/admin/products');
    } catch (error: any) {
      console.error('[CreateProduct] Error during submission flow:', error);
      toast.error(error?.response?.data?.error || error.message || 'Failed to create product');
      setUploadStatus(selectedFile ? 'error' : 'idle');
    } finally {
      console.log('[CreateProduct] Finished submission flow, cleaning up state.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/products')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Create Product</h1>
      </div>
      
      <Card className="premium-shadow border-none">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Product Details
          </CardTitle>
          <CardDescription>
            Enter the details for the new product. Name and Price are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Product Name <span className="text-destructive">*</span></label>
                <Input 
                  {...register('name')} 
                  placeholder="e.g. Wireless Headphones"
                  className={errors.name ? 'border-destructive' : ''}
                  disabled={isSubmitting}
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>
              
              {/* Price */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Price (USD) <span className="text-destructive">*</span></label>
                <Input 
                  type="number"
                  step="0.01"
                  {...register('price')} 
                  placeholder="e.g. 99.99"
                  className={errors.price ? 'border-destructive' : ''}
                  disabled={isSubmitting}
                />
                {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <textarea 
                {...register('description')} 
                placeholder="Product description..."
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isSubmitting}
              />
              {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* SKU */}
              <div className="space-y-2">
                <label className="text-sm font-medium">SKU</label>
                <Input 
                  {...register('sku')} 
                  placeholder="e.g. WH-1000XM4"
                  disabled={isSubmitting}
                />
              </div>
              
              {/* Category */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Input 
                  {...register('category')} 
                  placeholder="e.g. Electronics"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Product Image</label>
              
              <div className={`relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center transition-colors overflow-hidden ${
                  uploadStatus === 'success' ? 'border-green-500 bg-green-500/5' : 
                  uploadStatus === 'error' ? 'border-destructive bg-destructive/5' : 
                  'border-border bg-muted/20 hover:bg-muted/40'
                }`}
              >
                {uploadStatus === 'uploading' && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                    <div className="flex space-x-2">
                      <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <span className="text-sm font-medium mt-3 text-muted-foreground">Uploading image...</span>
                  </div>
                )}
                
                <input 
                  type="file" 
                  accept="image/jpeg, image/png, image/webp" 
                  onChange={handleFileChange}
                  className="hidden"
                  id="product-image-upload"
                  disabled={isSubmitting}
                />
                <label htmlFor="product-image-upload" className={`cursor-pointer flex flex-col items-center ${isSubmitting ? 'pointer-events-none opacity-50' : ''}`}>
                  {selectedFile ? (
                    <>
                      <FileIcon className="h-10 w-10 text-primary mb-3" />
                      <span className="font-medium text-sm text-center">{selectedFile.name}</span>
                      <span className="text-xs text-muted-foreground mt-1">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-10 w-10 text-muted-foreground mb-3" />
                      <span className="font-medium text-sm">Click to select an image</span>
                      <span className="text-xs text-muted-foreground mt-1">JPEG, PNG, or WebP up to 5MB</span>
                    </>
                  )}
                </label>
              </div>

              {uploadStatus === 'success' && (
                <div className="flex items-center text-green-600 dark:text-green-400 gap-1.5 text-xs font-medium mt-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Image uploaded successfully!
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-4 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate('/admin/products')} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSubmitting && uploadStatus === 'uploading' ? 'Uploading...' : isSubmitting ? 'Creating...' : 'Create Product'}
              </Button>
            </div>
            
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
