const fs = require('fs'); 
let c = fs.readFileSync('src/pages/Profile.tsx', 'utf8'); 
let lines = c.split('\n'); 
let old = lines.slice(0, 337).join('\n'); 
let newCode = `

import { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '@/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { LogOut, User, ShieldCheck, Mail, Camera, Loader2, Edit3, Image as ImageIcon, X } from 'lucide-react';
import { signOut } from 'aws-amplify/auth';
import { logout } from '@/store/slices/authSlice';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { UserAPI, MediaAPI } from '@/api/services';

export const Profile = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Core Data State
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Display images
  const [profileImageSrc, setProfileImageSrc] = useState<string | null>(null);
  const [backgroundImageSrc, setBackgroundImageSrc] = useState<string | null>(null);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const editAvatarInputRef = useRef<HTMLInputElement>(null);
  const editCoverInputRef = useRef<HTMLInputElement>(null);

  const fetchProfile = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const response = await UserAPI.getProfile(user.id);
      const data = response.data.data || response.data;
      setProfileData(data);

      if (data.profile_image_url) {
        try {
          const mediaResponse = await MediaAPI.getDownloadUrl(data.profile_image_url);
          setProfileImageSrc(mediaResponse.data.url);
        } catch (err) {
          console.error('Failed to load profile image', err);
        }
      }
      
      if (data.profile_background_url) {
        try {
          const mediaResponse = await MediaAPI.getDownloadUrl(data.profile_background_url);
          setBackgroundImageSrc(mediaResponse.data.url);
        } catch (err) {
          console.error('Failed to load background image', err);
        }
      }
    } catch (error) {
      toast.error('Failed to load profile details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut();
      dispatch(logout());
      navigate('/login');
      toast.success('Successfully signed out');
    } catch (error: any) {
      toast.error('Error signing out');
    }
  };

  const openEditMode = () => {
    setEditName(profileData?.name || user?.name || '');
    setEditAvatarFile(null);
    setEditCoverFile(null);
    setIsEditing(true);
  };
  
  const cancelEditMode = () => {
    setIsEditing(false);
    setEditAvatarFile(null);
    setEditCoverFile(null);
    
    // Revoke object URLs to avoid memory leaks if we created any
    if (editAvatarFile && profileImageSrc?.startsWith('blob:')) {
      URL.revokeObjectURL(profileImageSrc);
    }
    if (editCoverFile && backgroundImageSrc?.startsWith('blob:')) {
      URL.revokeObjectURL(backgroundImageSrc);
    }
    
    // Re-fetch to restore original images
    fetchProfile();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'profiles' | 'banners') => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        toast.error('Invalid file type. Only JPEG, PNG, and WebP allowed.');
        return;
      }
      
      const objectUrl = URL.createObjectURL(file);
      
      if (type === 'profiles') {
        setEditAvatarFile(file);
        setProfileImageSrc(objectUrl);
      }
      if (type === 'banners') {
        setEditCoverFile(file);
        setBackgroundImageSrc(objectUrl);
      }
    }
  };

  const uploadFileToS3 = async (file: File, folder: 'profiles' | 'banners') => {
    const uploadUrlResponse = await MediaAPI.getUploadUrl({
      folder,
      fileName: file.name,
      contentType: file.type,
    });

    const resData = uploadUrlResponse.data.data || uploadUrlResponse.data;
    const { uploadUrl, key } = resData;

    if (!uploadUrl) throw new Error('No upload URL returned');

    await MediaAPI.uploadToS3(uploadUrl, file);
    return key;
  };

  const handleSaveChanges = async () => {
    if (!user?.id) return;
    setIsSaving(true);
    
    try {
      const payload: any = { name: editName };

      // Sequentially upload images if selected
      if (editAvatarFile) {
        toast.info('Uploading profile picture...');
        const avatarKey = await uploadFileToS3(editAvatarFile, 'profiles');
        payload.profile_image_url = avatarKey;
      }

      if (editCoverFile) {
        toast.info('Uploading cover photo...');
        const coverKey = await uploadFileToS3(editCoverFile, 'banners');
        payload.profile_background_url = coverKey;
      }

      toast.info('Saving profile changes...');
      await UserAPI.updateProfile(user.id, payload);
      
      toast.success('Profile updated successfully!');
      setIsEditing(false);
      
      // Refresh the view to get the final S3 presigned URLs instead of our blob URLs
      await fetchProfile();

    } catch (error: any) {
      toast.error('Failed to update profile. Please try again.');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="container mx-auto py-12 px-4 min-h-[calc(100vh-64px)] flex items-start justify-center bg-[#F8FAFC]">
      
      <Card className="w-full max-w-4xl border-none shadow-2xl shadow-indigo-100/50 rounded-[2.5rem] overflow-hidden relative bg-white mt-4">
        
        {/* Background Cover Area */}
        <div className="h-72 w-full relative group">
          {loading ? (
            <Skeleton className="w-full h-full rounded-none" />
          ) : backgroundImageSrc ? (
            <>
              <img src={backgroundImageSrc} alt="Cover" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/10 to-transparent"></div>
            </>
          ) : (
            <div className="w-full h-full bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 relative">
               <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-30"></div>
            </div>
          )}
          
          {/* Edit Overlay for Cover */}
          {isEditing && (
            <div 
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 cursor-pointer"
              onClick={() => editCoverInputRef.current?.click()}
            >
              <Button variant="secondary" size="lg" className="rounded-full shadow-2xl font-bold pointer-events-none hover:scale-105 transition-transform">
                <ImageIcon className="w-5 h-5 mr-2" /> Change Cover Photo
              </Button>
            </div>
          )}
          <input type="file" ref={editCoverInputRef} className="hidden" accept="image/jpeg, image/png, image/webp" onChange={(e) => handleFileChange(e, 'banners')} />
        </div>

        {/* Profile Content Container */}
        <div className="px-8 pb-10 sm:px-12">
          {/* Avatar Profile */}
          <div className="relative -mt-20 mb-6 flex justify-between items-end">
            <div className="relative group/avatar z-20">
              <div className="w-40 h-40 bg-white rounded-full p-2 shadow-2xl ring-4 ring-white/50 relative overflow-hidden">
                <div className="w-full h-full relative rounded-full overflow-hidden bg-slate-50">
                  {profileImageSrc ? (
                    <img src={profileImageSrc} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-16 h-16 text-slate-300" />
                    </div>
                  )}
                  
                  {/* Edit Overlay for Avatar */}
                  {isEditing && (
                    <div 
                      className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm flex flex-col items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-all duration-300 cursor-pointer"
                      onClick={() => editAvatarInputRef.current?.click()}
                    >
                      <Camera className="w-8 h-8 text-white mb-1 drop-shadow-md" />
                      <span className="text-[11px] text-white font-bold uppercase tracking-wider drop-shadow-md">Update</span>
                    </div>
                  )}
                </div>
              </div>
              <input type="file" ref={editAvatarInputRef} className="hidden" accept="image/jpeg, image/png, image/webp" onChange={(e) => handleFileChange(e, 'profiles')} />
            </div>

            {/* Action Buttons Container (Right Side) */}
            <div className="mb-4">
              {!loading && !isEditing && (
                <Button onClick={openEditMode} className="rounded-full h-12 px-6 font-bold shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5 transition-all bg-indigo-600 hover:bg-indigo-700 text-white">
                  <Edit3 className="w-4 h-4 mr-2" /> Edit Profile
                </Button>
              )}
              {isEditing && (
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    size="lg" 
                    onClick={cancelEditMode}
                    disabled={isSaving}
                    className="h-12 px-6 rounded-full font-bold transition-all hover:bg-slate-50"
                  >
                    <X className="mr-2 w-4 h-4" />
                    Cancel
                  </Button>
                  <Button 
                    size="lg" 
                    onClick={handleSaveChanges}
                    disabled={isSaving}
                    className="h-12 px-8 rounded-full font-bold shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5 transition-all bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {isSaving ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : null}
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Header Info */}
          <div className="mb-10">
            {loading ? (
               <div className="space-y-3">
                 <Skeleton className="h-10 w-64" />
                 <Skeleton className="h-5 w-48" />
               </div>
            ) : isEditing ? (
              <div className="space-y-2 max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Input 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={isSaving}
                  placeholder="Your Name"
                  className="h-14 text-3xl font-black text-slate-900 border-b-2 border-indigo-200 bg-indigo-50/50 rounded-t-2xl rounded-b-none focus-visible:ring-0 focus-visible:border-indigo-600 px-5 shadow-inner"
                />
                <p className="text-indigo-600 font-semibold text-sm px-2 flex items-center">
                  <Edit3 className="w-3 h-3 mr-1.5" /> Updating display name
                </p>
              </div>
            ) : (
              <div className="animate-in fade-in duration-500">
                <CardTitle className="text-4xl font-black text-slate-900 mb-1">{profileData?.name || user.name || 'Valued Member'}</CardTitle>
                <p className="text-slate-500 font-medium text-lg">Manage your personal information and preferences.</p>
              </div>
            )}
          </div>

          {/* Content Grid */}
          <div className="space-y-8">
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className={\`flex items-center p-6 bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 \${isEditing ? 'opacity-60 scale-[0.98]' : ''}\`}>
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mr-5 shrink-0 text-indigo-600">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Email Address</p>
                    <p className="font-bold text-slate-800 text-lg">{profileData?.email || user.email}</p>
                  </div>
                </div>
                
                <div className={\`flex items-center p-6 bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 \${isEditing ? 'opacity-60 scale-[0.98]' : ''}\`}>
                  <div className="w-14 h-14 rounded-2xl bg-purple-50 flex items-center justify-center mr-5 shrink-0 text-purple-600">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Account Role</p>
                    <p className="font-bold text-slate-800 text-lg capitalize">{profileData?.role || user.role}</p>
                  </div>
                </div>

              </div>
            )}

            {!isEditing && (
              <div className="pt-8 flex justify-end animate-in fade-in duration-500">
                <Button 
                  variant="ghost"
                  size="lg" 
                  onClick={handleSignOut}
                  className="h-12 px-6 rounded-full font-bold text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="mr-2 w-5 h-5" />
                  Sign Out
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};
`
fs.writeFileSync('src/pages/Profile.tsx', old + newCode);
