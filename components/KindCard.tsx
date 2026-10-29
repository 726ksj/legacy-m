import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./AppText";
import { KIND_TITLES } from "../lib/study";
import { type TestKind } from "../lib/weekly";
import { categoryColors } from "../lib/theme";

const KIND_ICONS: Record<TestKind, React.ComponentProps<typeof Ionicons>["name"]> = {
  vocab: "text",
  writing: "create-outline",
  order: "swap-vertical",
  sentence: "reorder-three",
};

// 학습/학습 결과 허브의 유형 한 칸. 세로 목록(1x4)의 한 줄로, 남는 화면 높이를 네 칸이 나눠 가진다.
export default function KindCard({
  kind,
  subtitle,
  onPress,
}: {
  kind: TestKind;
  subtitle: string;
  onPress: () => void;
}) {
  const palette = categoryColors[kind];
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: palette.bg,
        borderWidth: 1,
        borderColor: palette.border,
        flex: 1,
        minHeight: 92,
      }}
      className="flex-row items-center rounded-3xl px-6 active:opacity-80"
    >
      <View
        style={{ backgroundColor: palette.accent }}
        className="h-14 w-14 items-center justify-center rounded-2xl"
      >
        <Ionicons name={KIND_ICONS[kind]} size={28} color={palette.fg} />
      </View>
      <View className="ml-5 flex-1">
        <Text className="text-xl font-extrabold" style={{ color: palette.fg }}>
          {KIND_TITLES[kind]}
        </Text>
        <Text className="mt-1 text-base text-ink-soft">{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={22} color={palette.fg} />
    </Pressable>
  );
}
