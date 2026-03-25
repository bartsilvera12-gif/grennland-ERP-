import { supabase } from "@/lib/supabase";

export type InboxConversation = {
  id: string;
  status: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  contact: {
    id: string;
    name: string | null;
    phone_number: string;
    cliente_id: string | null;
    crm_prospecto_id: string | null;
  };
};

export async function fetchChatConversations(): Promise<InboxConversation[]> {
  const { data: convs, error } = await supabase
    .from("chat_conversations")
    .select(
      `
      id,
      status,
      last_message_at,
      last_message_preview,
      unread_count,
      contact_id
    `
    )
    .order("last_message_at", { ascending: false });

  if (error) throw new Error(error.message);
  const list = convs ?? [];
  if (list.length === 0) return [];

  const contactIds = [...new Set(list.map((c) => c.contact_id as string))];
  const { data: contacts, error: e2 } = await supabase
    .from("chat_contacts")
    .select("id, name, phone_number, cliente_id, crm_prospecto_id")
    .in("id", contactIds);

  if (e2) throw new Error(e2.message);
  const byId = Object.fromEntries((contacts ?? []).map((c) => [c.id, c]));

  return list.map((row) => {
    const c = byId[row.contact_id as string];
    return {
      id: row.id as string,
      status: row.status as string,
      last_message_at: row.last_message_at as string | null,
      last_message_preview: row.last_message_preview as string | null,
      unread_count: (row.unread_count as number) ?? 0,
      contact: {
        id: c?.id ?? (row.contact_id as string),
        name: c?.name ?? null,
        phone_number: c?.phone_number ?? "",
        cliente_id: c?.cliente_id ?? null,
        crm_prospecto_id: c?.crm_prospecto_id ?? null,
      },
    };
  });
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const { error } = await supabase
    .from("chat_conversations")
    .update({ unread_count: 0, updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (error) throw new Error(error.message);
}
