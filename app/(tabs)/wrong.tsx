import { useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { Text } from "../../components/AppText";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../lib/supabase";
import { categoryColors, colors } from "../../lib/theme";
import {
  friendlyReviewError,
  GRADUATION_STEPS,
  listWrongNotes,
  MAX_REVIEW_QUESTIONS,
  startReviewSession,
  type WrongNote,
} from "../../lib/wrongNotes";
import { currentWeekOf, fetchWeeklyCourses } from "../../lib/weekly";
import EmptyState from "../../components/EmptyState";
import ScreenHeader from "../../components/ScreenHeader";

type Tab = "active" | "graduated";

// 주차가 지정되지 않은 단어장의 오답을 모아 보는 값.
const NO_WEEK = 0;

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
  // 보고 있는 주차(기본은 이번 주차). NO_WEEK(0)은 주차 미지정.
  const [week, setWeek] = useState<number | null>(null);
  const [currentWeek, setCurrentWeek] = useState<number | null>(null);
  const weekInitialized = useRef(false);

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
      const [loaded, courses] = await Promise.all([
        listWrongNotes(),
        fetchWeeklyCourses().catch(() => []),
      ]);
      setNotes(loaded);
      const now = currentWeekOf(courses);
      setCurrentWeek(now);
      // 처음 열 때만 이번 주차를 기본으로 고른다(이후엔 사용자가 고른 칩을 유지).
      // 이번 주차를 모르면 오답이 있는 가장 최근 주차, 오답이 없으면 1주차.
      if (!weekInitialized.current) {
        weekInitialized.current = true;
        const latest = Math.max(0, ...loaded.map((n) => n.week ?? 0));
        setWeek(now ?? (latest > 0 ? latest : 1));
      }
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

  // 학습 결과처럼 1주차부터 가장 늦은 주차까지 칩을 보여 준다(오답이 없는 주차도 포함).
  const weeks = useMemo(() => {
    const last = Math.max(currentWeek ?? 0, ...notes.map((n) => n.week ?? 0));
    return Array.from({ length: last }, (_, i) => i + 1);
  }, [notes, currentWeek]);
  const hasNoWeek = notes.some((n) => n.week === null);
  const selectedWeek = week ?? currentWeek ?? 1;

  const visible = useMemo(() => {
    const source = (tab === "active" ? active : graduated).filter(
      (n) => (n.week ?? NO_WEEK) === selectedWeek,
    );
    const sorted = [...source];
    if (tab === "graduated") {
      sorted.sort((a, b) => (b.graduated_at ?? "").localeCompare(a.graduated_at ?? ""));
    } else {
      // 많이 틀린 단어가 위로, 같으면 최근에 틀린 단어가 위로.
      sorted.sort(
        (a, b) => b.wrong_count - a.wrong_count || b.last_wrong_at.localeCompare(a.last_wrong_at),
      );
    }
    return sorted;
  }, [tab, selectedWeek, active, graduated]);

  // 주차 미지정 오답은 서버가 주차로 걸러 주지 못해서, 이 화면에서는 다시 풀기를 열지 않는다.
  const solvable =
    tab === "active" && selectedWeek !== NO_WEEK
      ? Math.min(visible.length, MAX_REVIEW_QUESTIONS)
      : 0;

  // 테스트(단어장)별로 묶어서 보여 준다. 처음 나온 순서(정렬 결과)를 유지한다.
  const sections = useMemo(() => {
    const map = new Map<string, { title: string; week: number | null; notes: WrongNote[] }>();
    for (const note of visible) {
      const entry = map.get(note.vocab_set_id) ?? {
        title: note.set_title,
        week: note.week,
        notes: [],
      };
      entry.notes.push(note);
      map.set(note.vocab_set_id, entry);
    }
    return [...map.entries()];
  }, [visible]);

  const startReview = async () => {
    setStarting(true);
    setError(null);
    try {
      const sessionId = await startReviewSession(selectedWeek);
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
              <Text className="mt-1 text-sm leading-5 text-ink-soft">
                마스터란, 틀린 단어를 서로 다른 날 연속 2번 맞혀서 오답노트에서 졸업하는 거예요.
                마스터한 단어도 다시 틀리면 오답으로 돌아와요.
              </Text>
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

            {/* 학습 결과처럼 주차 칩만 둔다. 이번 주차가 처음에 선택돼 있다. */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4">
              <View className="flex-row gap-2">
                {weeks.map((w) => (
                  <Chip
                    key={w}
                    label={`${w}주차`}
                    selected={selectedWeek === w}
                    onPress={() => setWeek(w)}
                  />
                ))}
                {hasNoWeek && (
                  <Chip
                    label="주차 미지정"
                    selected={selectedWeek === NO_WEEK}
                    onPress={() => setWeek(NO_WEEK)}
                  />
                )}
              </View>
            </ScrollView>

            <View className="mt-4 gap-5">
              {visible.length === 0 ? (
                <EmptyState
                  icon={tab === "active" ? "checkmark-circle-outline" : "school-outline"}
                  title={
                    tab === "active"
                      ? "이 주차에는 남은 오답이 없어요"
                      : "이 주차에는 마스터한 단어가 없어요"
                  }
                  description={
                    tab === "active"
                      ? "모든 오답을 마스터했어요. 잘했어요!"
                      : "서로 다른 날 연속 2번 맞히면 마스터해요"
                  }
                />
              ) : (
                sections.map(([setId, section]) => (
                  <View key={setId} className="gap-3">
                    <View className="flex-row items-center gap-2">
                      <View className="rounded-full px-2.5 py-0.5" style={{ backgroundColor: categoryColors.vocab.accent }}>
                        <Text className="text-sm font-bold" style={{ color: categoryColors.vocab.fg }}>
                          단어
                        </Text>
                      </View>
                      <Text className="flex-1 text-base font-bold text-ink-soft">
                        {section.week ? `${section.week}주차 · ` : ""}
                        {section.title}
                      </Text>
                      <Text className="text-sm font-bold text-ink-soft">{section.notes.length}개</Text>
                    </View>
                    {section.notes.map((note) => (
                      <NoteCard key={note.word_id} note={note} />
                    ))}
                  </View>
                ))
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
