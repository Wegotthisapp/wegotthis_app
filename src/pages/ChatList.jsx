import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { requireUser } from "../lib/auth";

export default function ChatList() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const user = await requireUser();

        const { data: convs, error: cErr } = await supabase
          .from("conversations")
          .select("id, user_a, user_b, last_message_at")
          .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
          .order("last_message_at", { ascending: false, nullsFirst: false });

        if (cErr) throw cErr;

        const convIds = (convs || []).map((c) => c.id);
        if (convIds.length === 0) {
          setItems([]);
          setLoading(false);
          return;
        }

        const { data: unreadRows } = await supabase
          .from("messages")
          .select("conversation_id")
          .in("conversation_id", convIds)
          .eq("receiver_id", user.id)
          .is("read_at", null);

        const unreadByConv = (unreadRows || []).reduce((acc, r) => {
          acc[r.conversation_id] = (acc[r.conversation_id] || 0) + 1;
          return acc;
        }, {});

        const { data: highlights } = await supabase
          .from("conversation_tasks")
          .select("conversation_id, highlight_until")
          .in("conversation_id", convIds);

        const now = Date.now();
        const highlightByConv = (highlights || []).reduce((acc, r) => {
          const until = r.highlight_until ? Date.parse(r.highlight_until) : 0;
          if (until > now) acc[r.conversation_id] = true;
          return acc;
        }, {});

        const mapped = convs.map((c) => {
          const otherUserId = c.user_a === user.id ? c.user_b : c.user_a;
          return {
            id: c.id,
            otherUserId,
            lastMessageAt: c.last_message_at,
            unread: unreadByConv[c.id] || 0,
            highlighted: !!highlightByConv[c.id],
          };
        });

        setItems(mapped);
      } catch (e) {
        console.error("ChatList error:", e);
        setItems([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div>Loading…</div>;
  if (!items.length) return <div>No chats yet.</div>;

  return (
    <div style={{ padding: 12 }}>
      <h2>Chats</h2>

      {items.map((c) => (
        <Link
          key={c.id}
          to={`/chat/c/${c.id}`}
          style={{
            display: "block",
            padding: 12,
            marginBottom: 10,
            border: "1px solid #ddd",
            borderRadius: 10,
            textDecoration: "none",
            background: c.highlighted ? "#fff7cc" : "white",
          }}
        >
          <div style={{ fontWeight: 700 }}>With: {c.otherUserId}</div>
          {c.unread > 0 && <div style={{ fontWeight: 600 }}>Unread: {c.unread}</div>}
          {c.highlighted && <div>New task activity</div>}
        </Link>
      ))}
    </div>
  );
}
