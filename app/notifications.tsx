import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "../components/ScreenHeader";
import EmptyState from "../components/EmptyState";
import { Text } from "../components/AppText";
import { supabase } from "../lib/supabase";
import { colors } from "../lib/theme";
import { isTestKind } from "../lib/study";

interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

// 알림함. 강사가 테스트를 올리면 쌓이는 알림을 최신순으로 보여주고, 누르면 해당 학습 유형으로 간다.
export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[] | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("notifications")
      .select("id, kind, title, body, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    setItems((data as Notification[]) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function open(n: Notification) {
    if (!n.read_at) {
      const now = new Date().toISOString();
      setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, read_at: now } : x)) ?? prev);
      await supabase.from("notifications").update({ read_at: now }).eq("id", n.id);
    }
    if (isTestKind(n.kind)) router.push(`/learn/${n.kind}`);
  }

  return (
    <View className="flex-1 bg-blush">
      <ScreenHeader title="알림함" back />
      {items === null ? (
        <View className="py-16">
          <ActivityIndicator color={colors.brand} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title="새 알림이 없습니다"
          description="새 소식이 생기면 여기에 표시돼요."
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {items.map((n) => (
            <Pressable
              key={n.id}
              onPress={() => open(n)}
              className="flex-row items-center rounded-2xl border border-line bg-white p-4"
            >
              <View className="h-10 w-10 items-center justify-center rounded-full bg-cream">
                <Ionicons name="document-text-outline" size={20} color="#90243b" />
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-base font-bold text-ink">{n.title}</Text>
                {n.body && <Text className="mt-0.5 text-sm text-ink-soft">{n.body}</Text>}
                <Text className="mt-1 text-xs text-ink-soft">{timeAgo(n.created_at)}</Text>
              </View>
              {!n.read_at && <View className="ml-2 h-2.5 w-2.5 rounded-full bg-brand" />}
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
