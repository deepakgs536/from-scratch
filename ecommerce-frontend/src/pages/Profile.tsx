// --- OLD MODAL IMPLEMENTATION (Retained for reference) ---
// import { useEffect, useState, useRef } from 'react';
// import { useSelector, useDispatch } from 'react-redux';
// import type { RootState } from '@/store';
// import { Button } from '@/components/ui/button';
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { Skeleton } from '@/components/ui/skeleton';
// import { Input } from '@/components/ui/input';
// import { LogOut, User, ShieldCheck, Mail, Camera, Loader2, Edit3, Image as ImageIcon, CheckCircle2, X } from 'lucide-react';
// import { signOut } from 'aws-amplify/auth';
// import { logout } from '@/store/slices/authSlice';
// import { useNavigate } from 'react-router-dom';
// import { toast } from 'sonner';
// import { UserAPI, MediaAPI } from '@/api/services';
// 
// export const Profile = () => {
//   const { user } = useSelector((state: RootState) => state.auth);
//   const dispatch = useDispatch();
//   const navigate = useNavigate();
// 
//   // Core Data State
//   const [profileData, setProfileData] = useState<any>(null);
//   const [loading, setLoading] = useState(true);
//   const [profileImageSrc, setProfileImageSrc] = useState<string | null>(null);
//   const [backgroundImageSrc, setBackgroundImageSrc] = useState<string | null>(null);
// 
//   // Edit Modal State
//   const [isEditing, setIsEditing] = useState(false);
//   const [editName, setEditName] = useState('');
//   const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
//   const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
//   const [isSaving, setIsSaving] = useState(false);
// 
//   const editAvatarInputRef = useRef<HTMLInputElement>(null);
//   const editCoverInputRef = useRef<HTMLInputElement>(null);
// 
//   const fetchProfile = async () => {
//     if (!user?.id) return;
//     setLoading(true);
//     try {
//       const response = await UserAPI.getProfile(user.id);
//       const data = response.data.data || response.data;
//       setProfileData(data);
// 
//       if (data.profile_image_url) {
//         try {
//           const mediaResponse = await MediaAPI.getDownloadUrl(data.profile_image_url);
//           setProfileImageSrc(mediaResponse.data.url);
//         } catch (err) {
//           console.error("Failed to load profile image", err);
//         }
//       }
//       
//       if (data.profile_background_url) {
//         try {
//           const mediaResponse = await MediaAPI.getDownloadUrl(data.profile_background_url);
//           setBackgroundImageSrc(mediaResponse.data.url);
//         } catch (err) {
//           console.error("Failed to load background image", err);
//         }
//       }
//     } catch (error) {
//       toast.error('Failed to load profile details');
//     } finally {
//       setLoading(false);
//     }
//   };
// 
//   useEffect(() => {
//     fetchProfile();
//   }, [user]);
// 
//   const handleSignOut = async () => {
//     try {
//       await signOut();
//       dispatch(logout());
//       navigate('/login');
//       toast.success('Successfully signed out');
//     } catch (error: any) {
//       toast.error('Error signing out');
//     }
//   };
// 
//   const openEditModal = () => {
//     setEditName(profileData?.name || user?.name || '');
//     setEditAvatarFile(null);
//     setEditCoverFile(null);
//     setIsEditing(true);
//   };
// 
//   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'profiles' | 'banners') => {
//     if (e.target.files && e.target.files.length > 0) {
//       const file = e.target.files[0];
//       const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
//       if (!validTypes.includes(file.type)) {
//         toast.error('Invalid file type. Only JPEG, PNG, and WebP allowed.');
//         return;
//       }
//       if (type === 'profiles') setEditAvatarFile(file);
//       if (type === 'banners') setEditCoverFile(file);
//     }
//   };
// 
//   const uploadFileToS3 = async (file: File, folder: "profiles" | "banners") => {
//     const uploadUrlResponse = await MediaAPI.getUploadUrl({
//       folder,
//       fileName: file.name,
//       contentType: file.type,
//     });
// 
//     const resData = uploadUrlResponse.data.data || uploadUrlResponse.data;
//     const { uploadUrl, key } = resData;
// 
//     if (!uploadUrl) throw new Error('No upload URL returned');
// 
//     await MediaAPI.uploadToS3(uploadUrl, file);
//     return key;
//   };
// 
//   const handleSaveChanges = async () => {
//     if (!user?.id) return;
//     setIsSaving(true);
//     
//     try {
//       const payload: any = { name: editName };
// 
//       // Sequentially upload images if selected
//       if (editAvatarFile) {
//         toast.info("Uploading profile picture...");
//         const avatarKey = await uploadFileToS3(editAvatarFile, "profiles");
//         payload.profile_image_url = avatarKey;
//       }
// 
//       if (editCoverFile) {
//         toast.info("Uploading cover photo...");
//         const coverKey = await uploadFileToS3(editCoverFile, "banners");
//         payload.profile_background_url = coverKey;
//       }
// 
//       toast.info("Saving profile changes...");
//       await UserAPI.updateProfile(user.id, payload);
//       
//       toast.success("Profile updated successfully!");
//       setIsEditing(false);
//       
//       // Refresh the view
//       await fetchProfile();
// 
//     } catch (error: any) {
//       toast.error("Failed to update profile. Please try again.");
//       console.error(error);
//     } finally {
//       setIsSaving(false);
//     }
//   };
// 
//   if (!user) return null;
// 
//   return (
//     <div className="container mx-auto py-12 px-4 min-h-[calc(100vh-64px)] flex items-center justify-center bg-[#FAFAFA]">
//       
//       <Card className="w-full max-w-2xl border-none shadow-xl shadow-slate-200/50 rounded-[2rem] overflow-hidden premium-shadow relative">
//         
//         {/* Background Cover Area (Read-Only) */}
//         <div className="h-48 w-full relative">
//           {loading ? (
//             <Skeleton className="w-full h-full rounded-none" />
//           ) : backgroundImageSrc ? (
//             <img src={backgroundImageSrc} alt="Cover" className="w-full h-full object-cover" />
//           ) : (
//             <div className="w-full h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
//           )}
//           
//           {/* Avatar Profile (Read-Only) */}
//           <div className="absolute -bottom-16 left-8 z-10">
//             <div className="w-32 h-32 bg-white rounded-full p-1.5 shadow-xl relative">
//               {profileImageSrc ? (
//                 <img src={profileImageSrc} alt="Avatar" className="w-full h-full object-cover rounded-full" />
//               ) : (
//                 <div className="w-full h-full bg-slate-100 rounded-full flex items-center justify-center">
//                   <User className="w-12 h-12 text-slate-400" />
//                 </div>
//               )}
//             </div>
//           </div>
//         </div>
// 
//         <CardHeader className="pt-20 pb-6 px-8 flex flex-row items-start justify-between">
//           <div>
//             {loading ? (
//                <div className="space-y-2">
//                  <Skeleton className="h-8 w-48" />
//                  <Skeleton className="h-4 w-64" />
//                </div>
//             ) : (
//               <>
//                 <CardTitle className="text-3xl font-black text-slate-900">{profileData?.name || user.name || 'Valued Member'}</CardTitle>
//                 <p className="text-slate-500 font-medium">Manage your personal information</p>
//               </>
//             )}
//           </div>
//           
//           {!loading && (
//             <Button onClick={openEditModal} variant="outline" className="rounded-xl h-10 px-4 font-semibold shadow-sm hover:bg-slate-50">
//               <Edit3 className="w-4 h-4 mr-2" /> Edit Profile
//             </Button>
//           )}
//         </CardHeader>
// 
//         <CardContent className="px-8 pb-8 space-y-6">
//           {loading ? (
//             <div className="space-y-4">
//               <Skeleton className="h-20 w-full rounded-xl" />
//               <Skeleton className="h-20 w-full rounded-xl" />
//             </div>
//           ) : (
//             <div className="grid gap-6">
//               <div className="flex items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
//                 <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm mr-4 shrink-0">
//                   <Mail className="w-5 h-5 text-slate-600" />
//                 </div>
//                 <div>
//                   <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Email Address</p>
//                   <p className="font-semibold text-slate-900">{profileData?.email || user.email}</p>
//                 </div>
//               </div>
//               
//               <div className="flex items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
//                 <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm mr-4 shrink-0">
//                   <ShieldCheck className="w-5 h-5 text-slate-600" />
//                 </div>
//                 <div>
//                   <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Account Role</p>
//                   <p className="font-semibold text-slate-900 capitalize">{profileData?.role || user.role}</p>
//                 </div>
//               </div>
//             </div>
//           )}
// 
//           <div className="pt-8 border-t border-slate-100 flex justify-end">
//             <Button 
//               variant="destructive" 
//               size="lg" 
//               onClick={handleSignOut}
//               className="h-14 px-8 rounded-xl font-bold hover:-translate-y-0.5 transition-transform"
//             >
//               <LogOut className="mr-2 w-5 h-5" />
//               Sign Out
//             </Button>
//           </div>
//         </CardContent>
//       </Card>
// 
//       {/* Edit Profile Modal */}
//       {isEditing && (
//         <div className="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
//           <Card className="w-full max-w-lg shadow-2xl border-none rounded-[2rem] overflow-hidden">
//             <CardHeader className="bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between py-5 px-8">
//               <CardTitle className="text-xl font-bold">Edit Profile</CardTitle>
//               <Button variant="ghost" size="icon" onClick={() => setIsEditing(false)} disabled={isSaving} className="rounded-full">
//                 <X className="h-5 w-5" />
//               </Button>
//             </CardHeader>
//             <CardContent className="p-8 space-y-6">
//               
//               {/* Name Edit */}
//               <div className="space-y-2">
//                 <label className="text-sm font-bold text-slate-700">Display Name</label>
//                 <Input 
//                   value={editName}
//                   onChange={(e) => setEditName(e.target.value)}
//                   disabled={isSaving}
//                   className="h-12 rounded-xl bg-slate-50 border-slate-200 focus-visible:ring-primary/20"
//                 />
//               </div>
// 
//               {/* Avatar Edit */}
//               <div className="space-y-2">
//                 <label className="text-sm font-bold text-slate-700">Profile Picture</label>
//                 <div 
//                   className={`border-2 border-dashed rounded-xl p-4 flex items-center justify-between cursor-pointer transition-colors ${editAvatarFile ? 'border-primary bg-primary/5' : 'border-slate-200 hover:bg-slate-50'} ${isSaving ? 'opacity-50 pointer-events-none' : ''}`}
//                   onClick={() => editAvatarInputRef.current?.click()}
//                 >
//                   <div className="flex items-center gap-3">
//                     <div className={`w-10 h-10 rounded-full flex items-center justify-center ${editAvatarFile ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-500'}`}>
//                       {editAvatarFile ? <CheckCircle2 className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
//                     </div>
//                     <div className="flex flex-col">
//                       <span className="text-sm font-semibold text-slate-900">{editAvatarFile ? editAvatarFile.name : 'Choose an image...'}</span>
//                       <span className="text-xs text-slate-500">JPEG, PNG, WebP up to 5MB</span>
//                     </div>
//                   </div>
//                   <Button type="button" variant="secondary" size="sm" className="rounded-full" disabled={isSaving}>Browse</Button>
//                 </div>
//                 <input type="file" ref={editAvatarInputRef} className="hidden" accept="image/jpeg, image/png, image/webp" onChange={(e) => handleFileChange(e, 'profiles')} />
//               </div>
// 
//               {/* Cover Edit */}
//               <div className="space-y-2">
//                 <label className="text-sm font-bold text-slate-700">Background Cover</label>
//                 <div 
//                   className={`border-2 border-dashed rounded-xl p-4 flex items-center justify-between cursor-pointer transition-colors ${editCoverFile ? 'border-primary bg-primary/5' : 'border-slate-200 hover:bg-slate-50'} ${isSaving ? 'opacity-50 pointer-events-none' : ''}`}
//                   onClick={() => editCoverInputRef.current?.click()}
//                 >
//                   <div className="flex items-center gap-3">
//                     <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${editCoverFile ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-500'}`}>
//                       {editCoverFile ? <CheckCircle2 className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
//                     </div>
//                     <div className="flex flex-col truncate w-48">
//                       <span className="text-sm font-semibold text-slate-900 truncate">{editCoverFile ? editCoverFile.name : 'Choose an image...'}</span>
//                       <span className="text-xs text-slate-500">High resolution recommended</span>
//                     </div>
//                   </div>
//                   <Button type="button" variant="secondary" size="sm" className="rounded-full shrink-0" disabled={isSaving}>Browse</Button>
//                 </div>
//                 <input type="file" ref={editCoverInputRef} className="hidden" accept="image/jpeg, image/png, image/webp" onChange={(e) => handleFileChange(e, 'banners')} />
//               </div>
// 
//               <div className="pt-4 flex justify-end gap-3">
//                 <Button variant="outline" className="h-12 px-6 rounded-xl font-semibold" onClick={() => setIsEditing(false)} disabled={isSaving}>
//                   Cancel
//                 </Button>
//                 <Button className="h-12 px-8 rounded-xl font-bold" onClick={handleSaveChanges} disabled={isSaving}>
//                   {isSaving ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
//                   {isSaving ? 'Saving Changes...' : 'Save Changes'}
//                 </Button>
//               </div>
//             </CardContent>
//           </Card>
//         </div>
//       )}
// 
//     </div>
//   );
// };
// --- END OLD MODAL IMPLEMENTATION ---


import { useEffect, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '@/store';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { LogOut, User, ShieldCheck, Mail, Camera, Loader2, Edit3, Image as ImageIcon } from 'lucide-react';
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
        <div className="px-6 sm:px-10 pb-10">
          
          {/* Avatar & Action Button Row */}
          <div className="flex justify-between items-start relative -mt-16 sm:-mt-20 mb-4">
            
            {/* Avatar */}
            <div className="relative group/avatar z-20">
              <div className="w-32 h-32 sm:w-40 sm:h-40 bg-white rounded-full p-1.5 shadow-sm relative overflow-hidden">
                <div className="w-full h-full relative rounded-full overflow-hidden bg-slate-50 border border-slate-100">
                  {profileImageSrc ? (
                    <img src={profileImageSrc} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-12 h-12 text-slate-300" />
                    </div>
                  )}
                  
                  {/* Edit Overlay for Avatar */}
                  {isEditing && (
                    <div 
                      className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm flex flex-col items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-all duration-300 rounded-full cursor-pointer"
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

            {/* Action Buttons */}
            <div className="pt-20 sm:pt-24 flex gap-3 z-10">
              {!loading && !isEditing && (
                <Button onClick={openEditMode} variant="outline" className="rounded-full h-10 px-6 font-semibold border-slate-300 hover:bg-slate-50 text-slate-700 transition-all">
                  <Edit3 className="w-4 h-4 mr-2" /> Edit Profile
                </Button>
              )}
              {isEditing && (
                <>
                  <Button 
                    variant="ghost" 
                    size="lg" 
                    onClick={cancelEditMode}
                    disabled={isSaving}
                    className="h-10 px-6 rounded-full font-semibold transition-all hover:bg-slate-100"
                  >
                    Cancel
                  </Button>
                  <Button 
                    size="lg" 
                    onClick={handleSaveChanges}
                    disabled={isSaving}
                    className="h-10 px-6 rounded-full font-semibold shadow-sm transition-all bg-slate-900 hover:bg-slate-800 text-white"
                  >
                    {isSaving ? <Loader2 className="mr-2 w-4 h-4 animate-spin" /> : null}
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Header Info (Name & Description) */}
          <div className="mb-8">
            {loading ? (
               <div className="space-y-3">
                 <Skeleton className="h-8 w-48" />
                 <Skeleton className="h-4 w-64" />
               </div>
            ) : isEditing ? (
              <div className="space-y-2 max-w-md animate-in fade-in duration-300">
                <Input 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  disabled={isSaving}
                  placeholder="Your Name"
                  className="h-12 text-xl font-bold text-slate-900 border-slate-200 focus-visible:ring-slate-900 rounded-xl"
                />
                <p className="text-slate-500 font-medium text-sm px-1 flex items-center">
                  <Edit3 className="w-3 h-3 mr-1.5" /> Updating display name
                </p>
              </div>
            ) : (
              <div className="animate-in fade-in duration-500">
                <CardTitle className="text-xl sm:text-2xl font-bold text-slate-900 mb-1">{profileData?.name || user.name || 'Valued Member'}</CardTitle>
                <p className="text-slate-500 text-sm">{profileData?.email || user.email}</p>
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
                
                <div className={`flex items-center p-6 bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 ${isEditing ? 'opacity-60 scale-[0.98]' : ''}`}>
                  <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mr-4 shrink-0 text-indigo-600">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Email Address</p>
                    <p className="font-semibold text-slate-800 text-base">{profileData?.email || user.email}</p>
                  </div>
                </div>
                
                <div className={`flex items-center p-6 bg-white rounded-2xl border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 ${isEditing ? 'opacity-60 scale-[0.98]' : ''}`}>
                  <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center mr-4 shrink-0 text-purple-600">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Account Role</p>
                    <p className="font-semibold text-slate-800 text-base capitalize">{profileData?.role || user.role}</p>
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
