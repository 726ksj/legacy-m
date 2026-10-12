import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

// 목록이 비었을 때 쓰는 공통 안내. 크림색 원 안에 와인색 아이콘.
export default function EmptyState({
  icon = "file-tray-outline",
  title,
  description,
}: {
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  description?: string;
}) {
  return (
    <View className="items-center px-10 py-16">
      <View className="h-20 w-20 items-center justify-center rounded-full bg-cream">
        <Ionicons name={icon} size={38} color="#90243b" />
      </View>
      <Text className="mt-4 text-lg font-bold text-ink">{title}</Text>
      {description && (
        <Text className="mt-1.5 text-center text-base text-ink-soft">
          {description}
        </Text>
      )}
    </View>
  );
}
