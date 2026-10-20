import { Pressable, View } from "react-native";
import { Text } from "./AppText";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { categoryColors, colors } from "../lib/theme";
import { testRoute, type WeeklyTask } from "../lib/weekly";

// 학습 목록의 시험 한 줄: 제목과 주차, 이동 화살표만 보여 준다.
export default function TaskRow({ task }: { task: WeeklyTask }) {
  // 단어는 민트, 어순 배열은 분홍, 순서 배열은 파랑으로 구분한다.
  const palette = categoryColors[task.kind];
  const open = () => router.push(testRoute(task.kind, task.id));

  return (
    <Pressable
      onPress={open}
      style={{
        backgroundColor: palette.bg,
        borderWidth: 1,
        borderColor: palette.border,
      }}
      className="flex-row items-center justify-between rounded-3xl px-6 py-6 active:opacity-80"
    >
      <View className="flex-1 pr-3">
        <Text className="text-xl font-bold text-ink">{task.title}</Text>
        {task.week !== null && (
          <Text className="mt-1 text-base text-ink-soft">{task.week}주차</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={22} color={colors.inkMuted} />
    </Pressable>
  );
}
