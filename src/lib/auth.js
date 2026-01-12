import { supabase } from "./supabaseClient";

export async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data?.user) throw new Error("Not authenticated");
  return data.user;
}
