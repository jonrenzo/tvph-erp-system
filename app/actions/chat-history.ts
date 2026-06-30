"use server";

import { createClient } from "@/utils/supabase/server";
import type { UIMessage } from "ai";

export async function getChatHistory(): Promise<UIMessage[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("chat_messages")
    .select("message")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (data ?? []).map(r => r.message as UIMessage).reverse();
}

export async function saveMessages(messages: UIMessage[]): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("chat_messages").upsert(
    messages.map(m => ({ id: m.id, user_id: user.id, message: m })),
    { onConflict: "id" }
  );
}

export async function clearChatHistory(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("chat_messages").delete().eq("user_id", user.id);
}
