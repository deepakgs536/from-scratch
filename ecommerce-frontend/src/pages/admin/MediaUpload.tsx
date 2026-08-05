import React, { useState } from 'react';
import { MediaAPI } from '@/api/services';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UploadCloud, File, CheckCircle2, Copy } from 'lucide-react';
import { toast } from 'sonner';

export const MediaUpload = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<{ key: string; uploadUrl: string; imageUrl: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      
      if (!validTypes.includes(file.type)) {
        toast.error('Invalid file type. Only JPEG, PNG, and WebP are allowed.');
        setSelectedFile(null);
        e.target.value = ''; // clear input
        return;
      }
      
      setSelectedFile(file);
      setUploadResult(null);
      setProgress(0);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setProgress(0);
    setUploadResult(null);

    try {
      // 1. Get pre-signed URL
      const response = await MediaAPI.getUploadUrl({
        folder: 'products',
        fileName: selectedFile.name,
        contentType: selectedFile.type,
      });

      // Handle mock response structure vs real response
      // Assume real response gives data.uploadUrl or data.data.uploadUrl
      const data = response.data;
      const { uploadUrl, key } = data;

      if (!uploadUrl) {
        throw new Error('No upload URL returned');
      }

      // 2. Upload directly to S3
      await MediaAPI.uploadToS3(uploadUrl, selectedFile);

      // 3. Success
      const downloadResponse = await MediaAPI.getDownloadUrl(key);
      const imageUrl = downloadResponse.data.url;
      setUploadResult({ key, uploadUrl, imageUrl });
      toast.success('File uploaded successfully!');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight">Media Upload</h1>

      <Card className="premium-shadow">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-primary" />
            Upload Image
          </CardTitle>
          <CardDescription>
            Upload images (JPEG, PNG, WebP) directly to S3. They will be stored in the 'products' folder.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center bg-muted/20 hover:bg-muted/40 transition-colors">
            <input 
              type="file" 
              accept="image/jpeg, image/png, image/webp" 
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
              disabled={uploading}
            />
            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
              {selectedFile ? (
                <>
                  <File className="h-12 w-12 text-primary mb-4" />
                  <span className="font-medium text-lg">{selectedFile.name}</span>
                  <span className="text-sm text-muted-foreground mt-1">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </>
              ) : (
                <>
                  <UploadCloud className="h-12 w-12 text-muted-foreground mb-4" />
                  <span className="font-medium text-lg">Click to select a file</span>
                  <span className="text-sm text-muted-foreground mt-1">JPEG, PNG, or WebP up to 5MB</span>
                </>
              )}
            </label>
          </div>

          {selectedFile && (
            <div className="flex justify-end">
              <Button onClick={handleUpload} disabled={uploading}>
                {uploading ? 'Uploading...' : 'Upload File'}
              </Button>
            </div>
          )}

          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-medium">
                <span>Uploading...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div 
                  className="bg-primary h-2.5 rounded-full transition-all duration-300 ease-in-out" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {uploadResult && (
            <div className="mt-8 p-6 bg-green-500/10 border border-green-500/20 rounded-xl space-y-4">
              <div className="flex items-center text-green-600 dark:text-green-400 gap-2 font-semibold">
                <CheckCircle2 className="h-5 w-5" />
                Upload Successful
              </div>
              
              <div className="space-y-3 text-sm">
                <div>
                  <label className="font-medium mb-1 block text-muted-foreground">S3 Object Key</label>
                  <div className="flex gap-2">
                    <Input readOnly value={uploadResult.key} className="bg-background font-mono text-xs" />
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(uploadResult.key, 'Key')}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="font-medium mb-1 block text-muted-foreground">Pre-signed Upload URL</label>
                  <div className="flex gap-2">
                    <textarea 
                      readOnly 
                      value={uploadResult.uploadUrl} 
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px]" 
                    />
                    <Button variant="outline" size="icon" onClick={() => copyToClipboard(uploadResult.uploadUrl, 'URL')} className="h-auto">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {uploadResult && (
                  <div className="space-y-4">

                      <img
                          src={uploadResult.imageUrl}
                          alt="Uploaded"
                          className="w-64 rounded-lg border"
                      />

                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
