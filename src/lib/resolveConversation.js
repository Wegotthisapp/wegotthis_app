// src/lib/resolveConversation.js
export async function resolveConversationId({ supabase, taskId, otherUserId }) {
  // 1) Current user
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  const user = userRes?.user;
  if (!user) throw new Error("Not authenticated");

  // 2) Stable ordering to prevent duplicates
  const a = user.id;
  const b = otherUserId;
  const user_a = a < b ? a : b;
  const user_b = a < b ? b : a;

  // 3) Find all conversations linked to this task, then match by user pair client-side.
  //    We cannot use .maybeSingle() here: a task can have many conversations
  //    (e.g. owner chatting with multiple responders), so the result is a list.
  //    Note: preventing duplicate conversations for the same (task, user pair) under
  //    concurrent requests requires a DB-level unique constraint on conversations
  //    (user_a, user_b, task_id via conversation_tasks). Until that exists, concurrent
  //    first-opens may create duplicate conversations — a safe but visible inconsistency.
  const { data: links, error: findErr } = await supabase
    .from("conversation_tasks")
    .select("conversation_id, conversations!inner(id, user_a, user_b)")
    .eq("task_id", taskId);

  if (findErr) throw findErr;

  const existingLink = (links || []).find(
    (l) => l.conversations?.user_a === user_a && l.conversations?.user_b === user_b
  );

  if (existingLink?.conversation_id) return existingLink.conversation_id;

  // 4) Create conversation
  const { data: convo, error: convoErr } = await supabase
    .from("conversations")
    .insert({ user_a, user_b })
    .select("id")
    .single();
  if (convoErr) throw convoErr;

  // 5) Link to task
  const { error: linkErr } = await supabase
    .from("conversation_tasks")
    .insert({ conversation_id: convo.id, task_id: taskId });
  if (linkErr) throw linkErr;

  return convo.id;
}
