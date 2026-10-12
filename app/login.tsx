import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { brandGradient, colors } from "../lib/theme";

const EMAIL_DOMAIN = "legacyedu.local";
const SAVED_USERNAME_KEY = "legacy-voca:saved-username";

function FormInput({
  label,
  focused,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  label: string;
  focused: boolean;
}) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-bold uppercase tracking-wider text-ink-soft">
        {label}
      </Text>
      <TextInput
        placeholderTextColor={colors.inkMuted}
        className={`rounded-2xl bg-blush px-4 py-4 text-lg text-ink border-2 ${
          focused ? "border-brand bg-white" : "border-transparent"
        }`}
        {...props}
      />
    </View>
  );
}

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberId, setRememberId] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<"username" | "password" | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SAVED_USERNAME_KEY).then((saved) => {
      if (saved) {
        setUsername(saved);
        setRememberId(true);
      }
    });
  }, []);

  const handleLogin = async () => {
    if (!username || !password) {
      setError("아이디와 비밀번호를 입력해주세요.");
      return;
    }

    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: `${username}@${EMAIL_DOMAIN}`,
      password,
    });

    if (signInError) {
      setError("아이디 또는 비밀번호가 올바르지 않습니다.");
      setLoading(false);
      return;
    }

    if (rememberId) {
      await AsyncStorage.setItem(SAVED_USERNAME_KEY, username);
    } else {
      await AsyncStorage.removeItem(SAVED_USERNAME_KEY);
    }

    setLoading(false);
    router.replace("/");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-blush"
    >
      <StatusBar style="light" />
      <ScrollView
        contentContainerClassName="flex-grow"
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <LinearGradient
          colors={brandGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: insets.top + 28,
            paddingBottom: 72,
            borderBottomLeftRadius: 40,
            borderBottomRightRadius: 40,
          }}
        >
          <View className="items-center">
            <View className="rounded-[34px] bg-white p-1.5 shadow-lg shadow-black/20">
              <Image
                source={require("../assets/images/logo-icon.png")}
                style={{ width: 104, height: 104 }}
                resizeMode="contain"
              />
            </View>
            <Text className="mt-5 text-3xl font-extrabold tracking-wide text-white">
              LEGACY M
            </Text>
            <Text className="mt-1.5 text-base font-medium text-cream">
              머릿속에 남는 기억
            </Text>
          </View>
        </LinearGradient>

        <View className="-mt-9 mx-5 rounded-3xl border border-line bg-white px-6 pb-8 pt-8 shadow-lg shadow-brand/20">
          <Text className="text-base text-ink-soft">
            아이디와 비밀번호로 로그인해주세요
          </Text>

          <View className="mt-6 gap-5">
            <FormInput
              label="아이디"
              value={username}
              onChangeText={setUsername}
              onFocus={() => setFocusedField("username")}
              onBlur={() => setFocusedField(null)}
              focused={focusedField === "username"}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              returnKeyType="next"
            />

            <FormInput
              label="비밀번호"
              value={password}
              onChangeText={setPassword}
              onFocus={() => setFocusedField("password")}
              onBlur={() => setFocusedField(null)}
              focused={focusedField === "password"}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />

            <Pressable
              onPress={() => setRememberId((v) => !v)}
              className="flex-row items-center justify-between py-1"
            >
              <Text className="text-base font-medium text-ink">
                아이디 저장
              </Text>
              <Switch
                value={rememberId}
                onValueChange={setRememberId}
                trackColor={{ true: colors.brand }}
              />
            </Pressable>

            {error && (
              <View className="rounded-xl bg-red-50 px-4 py-3">
                <Text className="text-base font-semibold text-red-500">
                  {error}
                </Text>
              </View>
            )}

            <Pressable
              onPress={handleLogin}
              disabled={loading}
              style={({ pressed }) => ({
                opacity: loading ? 0.7 : pressed ? 0.85 : 1,
              })}
              className="mt-2 items-center rounded-2xl bg-brand py-4 shadow-md shadow-brand/40"
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-lg font-bold text-white">로그인</Text>
              )}
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
