import { supabase } from "../lib/supabaseClient";
import type { TaskType } from "../ui/taskColors";

export type InboxRow = {
  task_id: string;
  task_title: string;
  task_type: TaskType;
  task_owner_id: string;

  conversation_id: string;
  other_user_id: string;

  last_message_at: string | null;
  last_message_text: string | null;
  unread_count?: number;
};

export async function fetchInbox(userId: string): Promise<InboxRow[]> {
  const { data: ctRows, error: ctErr } = await supabase
    .from("conversation_tasks")
    .select(
      `
      task:tasks!conversation_tasks_task_id_fkey (
        id, title, task_type, user_id
      ),
      conversation:conversations!conversation_tasks_conversation_id_fkey (
        id, user_a, user_b
      )
    `
    );

  if (ctErr) throw ctErr;

  const conversationIds = (ctRows ?? [])
    .map((r: any) => r.conversation?.id)
    .filter(Boolean);

  let msgRows: any[] = [];
  if (conversationIds.length > 0) {
    const { data, error: msgErr } = await supabase
      .from("messages")
      .select("conversation_id, created_at, content, body")
      .in("conversation_id", conversationIds)
      .order("created_at", { ascending: false })
      .limit(2000);

    if (msgErr) throw msgErr;
    msgRows = data ?? [];
  }

  const lastByConversation = new Map<
    string,
    { created_at: string; content: string | null }
  >();

  for (const m of msgRows ?? []) {
    if (!lastByConversation.has(m.conversation_id)) {
      lastByConversation.set(m.conversation_id, {
        created_at: m.created_at,
        content: m.body ?? m.content ?? null,
      });
    }
  }

  const rows: InboxRow[] = (ctRows ?? []).map((r: any) => {
    const conv = r.conversation;
    const task = r.task;
    const otherUserId = conv.user_a === userId ? conv.user_b : conv.user_a;

    const last = lastByConversation.get(conv.id) ?? null;

    return {
      task_id: task.id,
      task_title: task.title,
      task_type: task.task_type,
      task_owner_id: task.user_id,

      conversation_id: conv.id,
      other_user_id: otherUserId,

      last_message_at: last?.created_at ?? null,
      last_message_text: last?.content ?? null,
    };
  });

  rows.sort((a, b) => {
    const at = a.last_message_at ? Date.parse(a.last_message_at) : 0;
    const bt = b.last_message_at ? Date.parse(b.last_message_at) : 0;
    return bt - at;
  });

  return rows;
}
