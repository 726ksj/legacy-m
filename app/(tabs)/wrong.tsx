import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { colors } from "../../lib/theme";
import {
  friendlyReviewError,
  GRADUATION_STEPS,
  listWrongNotes,
  MAX_REVIEW_QUESTIONS,
  startReviewSession,
  type WrongNote,
} from "../../lib/wrongNotes";
import EmptyState from "../../components/EmptyState";
import ScreenHeader from "../../components/ScreenHeader";

type Tab = "active" | "graduated";
type Sort = "count" | "recent" | "week";

const SORT_LABEL: Record<Sort, string> = {
  count: "많이 틀린 순",
  recent: "최근 순",
  week: "주차 순",
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full border px-3.5 py-1.5 ${
        selected ? "border-brand bg-brand" : "border-line bg-white"
      }`}
    >
      <Text className={`text-sm font-bold ${selected ? "text-white" : "text-ink-soft"}`}>
        {label}
      </Text>
    </Pressable>
  );
}

// 마스터 칸: 2칸 중 채워진 만큼 분홍으로 표시한다.
function GraduationSteps({ streak }: { streak: number }) {
  return (
    <View className="flex-row items-center gap-1">
      {Array.from({ length: GRADUATION_STEPS }, (_, i) => (
        <View
          key={i}
          className={`h-2.5 w-2.5 rounded-full ${i < streak ? "bg-brand" : "bg-line"}`}
        />
      ))}
    </View>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, "0")}`;
}

function NoteCard({ note }: { note: WrongNote }) {
  const graduated = note.status === "graduated";
  return (
    <View className="rounded-3xl border border-line bg-white px-5 py-4 shadow-sm shadow-brand/20">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-xl font-extrabold text-ink">{note.word}</Text>
          <Text className="mt-0.5 text-base text-ink-soft">{note.meaning}</Text>
        </View>
        {graduated ? (
          <View className="flex-row items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1">
            <Ionicons name="school" size={13} color="#059669" />
            <Text className="text-sm font-bold text-emerald-600">마스터</Text>
          </View>
        ) : (
          <View className="rounded-full bg-cream px-2.5 py-1">
            <Text className="text-sm font-bold text-berry">{note.wrong_count}번 틀림</Text>
          </View>
        )}
      </View>

      <View className="mt-3 flex-row flex-wrap items-center gap-2">
        {!graduated && (
          <View className="flex-row items-center gap-2 rounded-full bg-blush px-3 py-1">
            <GraduationSteps streak={note.streak} />
            <Text className="text-sm font-semibold text-ink-soft">
              마스터까지 {GRADUATION_STEPS - note.streak}번
            </Text>
          </View>
        )}
        {note.return_count > 0 && (
          <View className="rounded-full bg-red-50 px-2.5 py-1">
            <Text className="text-sm font-bold text-red-500">복귀 {note.return_count}</Text>
          </View>
        )}
        <Text className="text-sm text-ink-soft">
          {note.week ? `${note.week}주차 · ` : ""}
          {note.set_title}
          {graduated && note.graduated_at ? ` · ${formatDate(note.graduated_at)} 마스터` : ""}
        </Text>
      </View>
    </View>
  );
}

export default function WrongAnswersScreen() {
  const [notes, setNotes] = useState<WrongNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("active");
  const [sort, setSort] = useState<Sort>("count");
  const [week, setWeek] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    try {
      setNotes(await listWrongNotes());
    } catch (e) {
      setError(friendlyReviewError(e));
    }
  }, []);

  // 풀이를 마치고 돌아올 때마다 마스터 현황을 다시 불러온다.
  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const active = useMemo(() => notes.filter((n) => n.status === "active"), [notes]);
  const graduated = useMemo(() => notes.filter((n) => n.status === "graduated"), [notes]);
  const graduatedThisWeek = graduated.filter(
    (n) => n.graduated_at && Date.now() - new Date(n.graduated_at).getTime() < WEEK_MS,
  ).length;
  const graduationPct =
    notes.length === 0 ? 0 : Math.round((graduated.length / notes.length) * 100);

  const weeks = useMemo(
    () =>
      [...new Set(notes.map((n) => n.week).filter((w): w is number => w !== null))].sort(
        (a, b) => a - b,
      ),
    [notes],
  );

  const visible = useMemo(() => {
    const source = (tab === "active" ? active : graduated).filter(
      (n) => week === null || n.week === week,
    );
    const sorted = [...source];
    if (tab === "graduated") {
      sorted.sort((a, b) => (b.graduated_at ?? "").localeCompare(a.graduated_at ?? ""));
    } else if (sort === "count") {
      sorted.sort((a, b) => b.wrong_count - a.wrong_count || b.last_wrong_at.localeCompare(a.last_wrong_at));
    } else if (sort === "recent") {
      sorted.sort((a, b) => b.last_wrong_at.localeCompare(a.last_wrong_at));
    } else {
      sorted.sort((a, b) => (a.week ?? 99) - (b.week ?? 99) || b.wrong_count - a.wrong_count);
    }
    return sorted;
  }, [tab, sort, week, active, graduated]);

  const solvable = tab === "active" ? Math.min(visible.length, MAX_REVIEW_QUESTIONS) : 0;

  const startReview = async () => {
    setStarting(true);
    setError(null);
    try {
      const sessionId = await startReviewSession(week);
      router.push(`/review/${sessionId}`);
    } catch (e) {
      setError(friendlyReviewError(e));
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-blush">
        <ScreenHeader title="오답노트" />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.brand} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-blush">
      <ScreenHeader title="오답노트" />

      {notes.length === 0 && !error ? (
        <EmptyState
          icon="alert-circle-outline"
          title="아직 오답이 없어요"
          description="단어 테스트에서 틀린 단어가 여기에 모여요"
        />
      ) : (
        <>
          <ScrollView
            contentContainerClassName="px-6 pb-6"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />
            }
          >
            {error && (
              <View className="mt-4 rounded-xl bg-red-50 px-4 py-3">
                <Text className="text-base font-semibold text-red-500">{error}</Text>
              </View>
            )}

            <View className="mt-6 rounded-3xl border border-line bg-white px-5 py-5 shadow-sm shadow-brand/20">
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-bold text-ink">마스터 현황</Text>
                <Text className="text-base font-extrabold text-berry">{graduationPct}%</Text>
              </View>
              <View className="mt-3 h-2.5 w-full rounded-full bg-blush">
                <View className="h-2.5 rounded-full bg-brand" style={{ width: `${graduationPct}%` }} />
              </View>
              <View className="mt-4 flex-row">
                <View className="flex-1">
                  <Text className="text-sm text-ink-soft">남은 오답</Text>
                  <Text className="mt-0.5 text-2xl font-extrabold text-ink">{active.length}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm text-ink-soft">마스터</Text>
                  <Text className="mt-0.5 text-2xl font-extrabold text-ink">{graduated.length}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-sm text-ink-soft">이번 주 마스터</Text>
                  <Text className="mt-0.5 text-2xl font-extrabold text-ink">{graduatedThisWeek}</Text>
                </View>
              </View>
            </View>

            <View className="mt-5 flex-row rounded-2xl bg-white p-1">
              {(["active", "graduated"] as const).map((key) => (
                <Pressable
                  key={key}
                  onPress={() => setTab(key)}
                  className={`flex-1 items-center rounded-xl py-2.5 ${tab === key ? "bg-brand" : ""}`}
                >
                  <Text className={`text-base font-bold ${tab === key ? "text-white" : "text-ink-soft"}`}>
                    {key === "active" ? `남은 오답 ${active.length}` : `마스터 보관함 ${graduated.length}`}
                  </Text>
                </Pressable>
              ))}
            </View>

            {tab === "active" && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4">
                <View className="flex-row gap-2">
                  {(Object.keys(SORT_LABEL) as Sort[]).map((key) => (
                    <Chip key={key} label={SORT_LABEL[key]} selected={sort === key} onPress={() => setSort(key)} />
                  ))}
                </View>
              </ScrollView>
            )}

            {weeks.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3">
                <View className="flex-row gap-2">
                  <Chip label="전체" selected={week === null} onPress={() => setWeek(null)} />
                  {weeks.map((w) => (
                    <Chip key={w} label={`${w}주차`} selected={week === w} onPress={() => setWeek(w)} />
                  ))}
                </View>
              </ScrollView>
            )}

            <View className="mt-4 gap-3">
              {visible.length === 0 ? (
                <EmptyState
                  icon={tab === "active" ? "checkmark-circle-outline" : "school-outline"}
                  title={tab === "active" ? "남은 오답이 없어요" : "아직 마스터한 단어가 없어요"}
                  description={
                    tab === "active"
                      ? "모든 오답을 마스터했어요. 잘했어요!"
                      : "서로 다른 날 연속 2번 맞히면 마스터해요"
                  }
                />
              ) : (
                visible.map((note) => <NoteCard key={note.word_id} note={note} />)
              )}
            </View>
          </ScrollView>

          {solvable > 0 && (
            <View className="border-t border-line bg-white px-6 pb-3 pt-3">
              <Pressable
                onPress={startReview}
                disabled={starting}
                style={({ pressed }) => ({ opacity: pressed || starting ? 0.8 : 1 })}
                className="items-center rounded-2xl bg-brand py-4 shadow-md shadow-brand/40"
              >
                {starting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-lg font-bold text-white">
                    오답 다시 풀기 ({solvable}문제)
                  </Text>
                )}
              </Pressable>
            </View>
          )}
        </>
      )}
    </View>
  );
}
