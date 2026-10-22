import { View } from "react-native";
import ScreenHeader from "../components/ScreenHeader";
import EmptyState from "../components/EmptyState";

// 알림함. 아직 알림을 보내는 기능이 없어 빈 상태만 보여준다.
export default function NotificationsScreen() {
  return (
    <View className="flex-1 bg-blush">
      <ScreenHeader title="알림함" back />
      <EmptyState
        icon="notifications-outline"
        title="새 알림이 없습니다"
        description="새 소식이 생기면 여기에 표시돼요."
      />
    </View>
  );
}
