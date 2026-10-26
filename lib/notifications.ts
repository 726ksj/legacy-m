import { supabase } from "./supabase";

// 안 읽은 알림 개수(홈의 벨 아이콘 배지). 읽음 표시(read_at)가 없는 알림만 센다.
export async function fetchUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);
  if (error) return 0;
  return count ?? 0;
}
