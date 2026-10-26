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

// 학습/학습 결과 허브의 유형 한 칸. 세로로 긴 카드에 아이콘, 이름, 한 줄 설명을 보여 준다.
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
        aspectRatio: 0.78,
      }}
      className="flex-1 justify-between rounded-3xl p-5 active:opacity-80"
    >
      <View
        style={{ backgroundColor: palette.accent }}
        className="h-12 w-12 items-center justify-center rounded-2xl"
      >
        <Ionicons name={KIND_ICONS[kind]} size={26} color={palette.fg} />
      </View>
      <View>
        <Text className="text-xl font-extrabold" style={{ color: palette.fg }}>
          {KIND_TITLES[kind]}
        </Text>
        <Text className="mt-1 text-base text-ink-soft">{subtitle}</Text>
      </View>
    </Pressable>
  );
}
