"use server";

import { createClient } from "@/utils/supabase/server";

export type UploadedFileInfo = {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
};

export async function uploadChatFile(formData: FormData): Promise<UploadedFileInfo | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const file = formData.get("file") as File;
  if (!file || file.size === 0) return { error: "No file provided" };

  if (file.size > 20 * 1024 * 1024) {
    return { error: "File too large. Maximum size is 20MB." };
  }

  const fileExt = file.name.split(".").pop();
  const uniqueName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${fileExt}`;
  const filePath = `${user.id}/${uniqueName}`;

  const { error: uploadError } = await supabase.storage
    .from("chat-uploads")
    .upload(filePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return { error: `Upload failed: ${uploadError.message}. Make sure the 'chat-uploads' bucket exists in Supabase Storage.` };
  }

  const { data: signedUrlData } = await supabase.storage
    .from("chat-uploads")
    .createSignedUrl(filePath, 3600);

  return {
    id: filePath,
    name: file.name,
    type: file.type,
    size: file.size,
    url: signedUrlData?.signedUrl || "",
  };
}
