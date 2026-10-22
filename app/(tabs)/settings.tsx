import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, View } from "react-native";
import { Text } from "../../components/AppText";
import { router } from "expo-router";
import { supabase } from "../../lib/supabase";
import { colors } from "../../lib/theme";
import ScreenHeader from "../../components/ScreenHeader";

export default function SettingsScreen() {
  const [name, setName] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("name, username")
      .eq("id", session.user.id)
      .single();

    setName(profile?.name ?? null);
    setUsername(profile?.username ?? null);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const logout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  // Alert.alert는 웹에서 동작하지 않아 웹은 브라우저 확인창을 쓴다.
  const handleLogout = () => {
    if (Platform.OS === "web") {
      if (window.confirm("로그아웃 하시겠어요?")) void logout();
      return;
    }
    Alert.alert("로그아웃", "로그아웃 하시겠어요?", [
      { text: "취소", style: "cancel" },
      { text: "로그아웃", style: "destructive", onPress: () => void logout() },
    ]);
  };

  if (loading) {
    return (
      <View className="flex-1 bg-blush">
        <ScreenHeader title="설정" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-blush">
      <ScreenHeader title="설정" />
      <View className="px-6">
        <View className="mt-6 rounded-3xl border border-line bg-white px-5 py-5 shadow-sm shadow-brand/20">
          <Text className="text-lg font-bold text-ink">{name ?? "회원"}</Text>
          {username && <Text className="mt-1 text-base text-ink-soft">@{username}</Text>}
        </View>

        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          className="mt-8 items-center rounded-2xl border border-line bg-white py-4"
        >
          <Text className="text-base font-bold text-red-500">로그아웃</Text>
        </Pressable>
      </View>
    </View>
  );
}
