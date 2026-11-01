import { Modal, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./AppText";

// LEGACY M 스타일의 예/아니오 팝업: 흰 둥근 카드, 크림색 원 안의 아이콘, 분홍 [예] 버튼.
// 시스템 Alert 대신 앱 안에서 그려서 앱·웹이 같은 모양이다.
export default function ConfirmModal({
  visible,
  message,
  yesLabel = "예",
  noLabel = "아니오",
  onYes,
  onNo,
}: {
  visible: boolean;
  message: string;
  yesLabel?: string;
  noLabel?: string;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onNo}>
      <View
        className="flex-1 items-center justify-center px-8"
        style={{ backgroundColor: "rgba(58, 27, 37, 0.45)" }}
      >
        <View
          className="w-full items-center rounded-3xl bg-white px-6 pb-6 pt-7"
          style={{ maxWidth: 360 }}
        >
          <View className="h-16 w-16 items-center justify-center rounded-full bg-cream">
            <Ionicons name="school" size={30} color="#90243b" />
          </View>
          <Text className="mt-4 text-center text-xl font-bold leading-8 text-ink">
            {message}
          </Text>
          <View className="mt-6 w-full flex-row gap-3">
            <Pressable
              onPress={onNo}
              className="flex-1 items-center rounded-2xl border border-line bg-white py-4 active:opacity-80"
            >
              <Text className="text-lg font-bold text-ink-soft">{noLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onYes}
              className="flex-1 items-center rounded-2xl bg-brand py-4 shadow-md shadow-brand/40 active:opacity-80"
            >
              <Text className="text-lg font-bold text-white">{yesLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
