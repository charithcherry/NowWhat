"use client";

import { useState } from "react";
import { Activity, Dumbbell, Radar as RadarIcon, LineChart as LineChartIcon, Frown, Smile, ShieldAlert, BarChart3 } from "lucide-react";
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis 
} from "recharts";
import { motion } from "framer-motion";
import { AgentChat } from "@/components/AgentChat";
import {
  formatMstDayKey,
  formatMstMonthKey,
  formatMstTimestamp,
  formatMstTrendPeriod,
  type TrendGranularity,
} from "@/lib/dashboardDates";

const EXERCISE_COLORS = [
  "#00ff88",
  "#00d9ff",
  "#ff9f1c",
  "#ff5d8f",
  "#8b5cf6",
  "#22c55e",
  "#f97316",
  "#38bdf8",
];

function formatExerciseLabel(value: string) {
  return value
    .split(" ")
    .map((part) => part.slice(0, 3))
    .join(" ")
    .slice(0, 9);
}

export default function DashboardClient({ 
  radarData, 
  symmetryData, 
  dailyExerciseData,
  exerciseKeys,
  motivationData, 
  totals,
  userId,
  userName
}: { 
  radarData: any[],
  symmetryData: any[], 
  dailyExerciseData: any[],
  exerciseKeys: string[],
  motivationData: any[],
  totals: any,
  userId: string,
  userName: string
}) {
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  const [trendGranularity, setTrendGranularity] = useState<TrendGranularity>("day");
  const exerciseColorMap = Object.fromEntries(
    exerciseKeys.map((exerciseName, index) => [
      exerciseName,
      EXERCISE_COLORS[index % EXERCISE_COLORS.length],
    ])
  );
  const activeExercises = selectedExercises.length > 0 ? selectedExercises : exerciseKeys;

  const timelineDays = dailyExerciseData.map((day) => {
    const entries = Object.entries(day)
      .filter(([key, value]) => key !== "date" && key !== "total" && Number(value) > 0)
      .map(([exerciseName, value]) => ({
        exerciseName,
        reps: Number(value),
      }))
      .sort(
        (left, right) =>
          exerciseKeys.indexOf(left.exerciseName) - exerciseKeys.indexOf(right.exerciseName)
      );

    return {
      date: String(day.date),
      entries,
    };
  });

  const filteredTimelineDays = timelineDays
    .map((day) => {
      const entries = day.entries.filter((entry) =>
        activeExercises.includes(entry.exerciseName)
      );

      return {
        date: day.date,
        entries,
        total: entries.reduce((sum, entry) => sum + entry.reps, 0),
      };
    })
    .filter((day) => day.entries.length > 0)
    .map((day, index, allDays) => {
      const currentMonth = day.date.slice(0, 7);
      const previousMonth = index > 0 ? allDays[index - 1]?.date.slice(0, 7) : "";

      return {
        ...day,
        showMonthLabel: index === 0 || currentMonth !== previousMonth,
      };
    });

  const globalMaxReps = Math.max(
    1,
    ...filteredTimelineDays.flatMap((day) => day.entries.map((entry) => entry.reps))
  );

  const repTrendMap = new Map<
    string,
    { periodKey: string; label: string; fullLabel: string; reps: number }
  >();

  filteredTimelineDays.forEach((day) => {
    const periodKey =
      trendGranularity === "year"
        ? day.date.slice(0, 4)
        : trendGranularity === "month"
          ? day.date.slice(0, 7)
          : day.date;

    if (!repTrendMap.has(periodKey)) {
      repTrendMap.set(periodKey, {
        periodKey,
        label: formatMstTrendPeriod(periodKey, trendGranularity),
        fullLabel: formatMstTrendPeriod(periodKey, trendGranularity),
        reps: 0,
      });
    }

    const current = repTrendMap.get(periodKey)!;
    current.reps += day.total;
  });

  const repTrendData = Array.from(repTrendMap.values());

  function toggleExercise(exerciseName: string) {
    setSelectedExercises((current) =>
      current.includes(exerciseName)
        ? current.filter((name) => name !== exerciseName)
        : [...current, exerciseName]
    );
  }

  return (
    <main className="min-h-screen bg-doom-bg text-doom-text p-4 md:p-8 overflow-y-auto">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-doom-primary/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto space-y-8 relative z-10 pb-20">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 bg-gradient-to-r from-doom-surface to-[#0a0d14] p-8 rounded-3xl border border-doom-primary/20 shadow-2xl">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <p className="text-doom-primary/80 font-medium tracking-wider uppercase text-sm mb-2 text-balance">
              Fitness Module & Analytics
            </p>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-balance">
              Keep pushing, <span className="text-doom-primary">{userName}</span>!
            </h1>
            <p className="text-doom-muted mt-3 max-w-xl text-balance">
              Here's your latest biomechanical breakdown and motivation streaks fetched securely from your database.
            </p>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2, duration: 0.5 }} className="flex items-center gap-4 bg-black/40 p-4 rounded-2xl border border-doom-primary/10 backdrop-blur-md">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path className="text-gray-800" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="text-doom-primary transition-all duration-1000 ease-out" strokeDasharray={`${totals.avgOverallForm}, 100`} strokeWidth="3" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
              <span className="absolute font-bold text-lg">{totals.avgOverallForm}</span>
            </div>
            <div>
              <p className="text-sm text-doom-muted">Average</p>
              <p className="font-semibold text-lg leading-tight">Form Score</p>
            </div>
          </motion.div>
        </header>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-doom-surface p-4 md:p-5 rounded-3xl border border-doom-primary/20 flex flex-col gap-1.5">
            <div className="p-2 bg-doom-primary/10 w-fit rounded-lg text-doom-primary">
              <Dumbbell className="w-5 h-5" />
            </div>
            <p className="text-doom-muted text-xs md:text-sm font-medium">Total Exercises Logged</p>
            <p className="text-2xl md:text-[1.75rem] font-bold">{totals.totalSessions}</p>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-doom-surface p-4 md:p-5 rounded-3xl border border-doom-accent/20 flex flex-col gap-1.5">
            <div className="p-2 bg-doom-accent/10 w-fit rounded-lg text-doom-accent">
              <Activity className="w-5 h-5" />
            </div>
            <p className="text-doom-muted text-xs md:text-sm font-medium">Total Reps Logged</p>
            <p className="text-2xl md:text-[1.75rem] font-bold">{totals.totalReps}</p>
          </motion.div>

          {totals.mostRecentDate && (
             <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-doom-surface p-4 md:p-5 rounded-3xl border border-orange-500/20 flex flex-col gap-1.5">
               <div className="p-2 bg-orange-500/10 w-fit rounded-lg text-orange-400">
                 <LineChartIcon className="w-5 h-5" />
               </div>
               <p className="text-doom-muted text-xs md:text-sm font-medium">Last Workout</p>
               <p suppressHydrationWarning className="text-lg md:text-xl font-bold text-orange-400 pt-0.5">{formatMstTimestamp(totals.mostRecentDate)}</p>
             </motion.div>
          )}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Radar Chart for Form Metrics */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }} className="bg-doom-surface p-6 md:p-8 rounded-3xl border border-doom-primary/20 shadow-xl flex flex-col items-center">
            <div className="w-full flex items-center gap-3 mb-6">
              <div className="p-2 bg-doom-primary/20 rounded-lg text-doom-primary">
                <RadarIcon className="w-6 h-6" />
              </div>
              <h2 className="text-xl md:text-2xl font-bold">Form Breakdown</h2>
            </div>
            <div className="h-72 w-full text-xs">
              {radarData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid stroke="#2d3748" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: '#a0aec0', fontSize: 13 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#4a5568' }} />
                    <Radar name="Score" dataKey="score" stroke="#00ff88" fill="#00ff88" fillOpacity={0.4} />
                    <Tooltip contentStyle={{ backgroundColor: '#151923', borderColor: '#00ff88', color: '#e0e6f0' }} />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-doom-muted">No form data available</div>
              )}
            </div>
          </motion.div>

          {/* Bar Chart for Symmetry */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} className="bg-doom-surface p-6 md:p-8 rounded-3xl border border-doom-accent/20 shadow-xl">
            <div className="flex items-center justify-between gap-3 mb-6">
               <div className="flex items-center gap-3">
                 <div className="p-2 bg-doom-accent/20 rounded-lg text-doom-accent">
                   <ShieldAlert className="w-6 h-6" />
                 </div>
                 <h2 className="text-xl md:text-2xl font-bold">Joint Symmetry</h2>
               </div>
               <span className="text-xs text-doom-muted px-2 py-1 bg-black/30 rounded border border-white/5">Degrees</span>
            </div>
            <div className="h-72 w-full text-xs md:text-sm">
              {symmetryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={symmetryData} margin={{ top: 20, right: 0, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" vertical={false} />
                    <XAxis dataKey="joint" stroke="#a0aec0" />
                    <YAxis stroke="#a0aec0" domain={[0, 180]} />
                    <Tooltip 
                       contentStyle={{ backgroundColor: '#151923', borderColor: '#00d9ff', color: '#e0e6f0' }}
                       cursor={{ fill: 'rgba(0, 217, 255, 0.1)' }}
                    />
                    <Bar dataKey="left" name="Left Side" fill="#00d9ff" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="right" name="Right Side" fill="#00ff88" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-doom-muted">No biomechanics data available</div>
              )}
            </div>
          </motion.div>

        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.9fr)_minmax(320px,1fr)] gap-8 items-start">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            className="bg-doom-surface p-6 md:p-8 rounded-3xl border border-emerald-500/20 shadow-xl"
          >
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/15 rounded-lg text-emerald-400">
                  <BarChart3 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold">Exercise Reps By Day</h2>
                  <p className="text-sm text-doom-muted mt-1">Daily rep volume split by exercise across a scrollable timeline.</p>
                </div>
              </div>
              <span className="text-xs text-doom-muted px-2 py-1 bg-black/30 rounded border border-white/5">
                Scroll timeline
              </span>
            </div>

            <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-xs text-doom-muted">
                Click one or more exercises to filter. Clear all to show everything.
              </p>
              <p className="text-xs text-doom-muted">
                {selectedExercises.length === 0
                  ? "Showing all exercises"
                  : `Showing ${selectedExercises.length} selected`}
              </p>
            </div>

            <div className="mb-5 flex flex-wrap gap-2">
              {exerciseKeys.map((exerciseName) => {
                const isActive = activeExercises.includes(exerciseName);
                return (
                  <button
                    key={exerciseName}
                    type="button"
                    onClick={() => toggleExercise(exerciseName)}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                      isActive
                        ? "border-white/20 bg-black/35 text-doom-text"
                        : "border-white/8 bg-black/10 text-doom-muted/60"
                    }`}
                    aria-pressed={isActive}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: exerciseColorMap[exerciseName] }}
                    />
                    <span>{exerciseName}</span>
                  </button>
                );
              })}
            </div>

            <div className="w-full overflow-x-auto overflow-y-hidden pb-2">
              {filteredTimelineDays.length > 0 ? (
                <div className="flex min-w-full items-start gap-3 pr-4">
                  {filteredTimelineDays.map((day) => (
                    <div key={day.date} className="w-[144px] shrink-0">
                      <div className="mb-2 min-h-[2.5rem] px-1">
                        {day.showMonthLabel ? (
                          <span className="inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                            {formatMstMonthKey(day.date)}
                          </span>
                        ) : null}
                      </div>

                      <div className="rounded-2xl border border-white/8 bg-black/25 p-3 shadow-inner shadow-black/20">
                        <div className="mb-3 border-b border-white/6 pb-2">
                          <p className="text-sm font-semibold text-doom-text">{formatMstDayKey(day.date)}</p>
                          <p className="text-[11px] uppercase tracking-[0.16em] text-doom-muted">
                            {day.total} reps
                          </p>
                        </div>

                        <div className="flex h-[11.5rem] items-end gap-2">
                          {day.entries.map((entry) => (
                            <div key={`${day.date}-${entry.exerciseName}`} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                              <span className="text-[10px] font-semibold text-doom-text/90">{entry.reps}</span>
                              <div
                                className="w-full rounded-t-md transition-all"
                                style={{
                                  height: `${Math.max(24, Math.round((entry.reps / globalMaxReps) * 124))}px`,
                                  backgroundColor: exerciseColorMap[entry.exerciseName],
                                }}
                                title={`${entry.exerciseName}: ${entry.reps} reps`}
                              />
                              <span className="w-full truncate text-center text-[10px] uppercase tracking-[0.12em] text-doom-muted" title={entry.exerciseName}>
                                {formatExerciseLabel(entry.exerciseName)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-[18.5rem] items-center justify-center text-doom-muted">
                  No timeline data for that exercise yet.
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-doom-surface p-6 md:p-8 rounded-3xl border border-cyan-500/20 shadow-xl"
          >
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/15 rounded-lg text-cyan-400">
                  <LineChartIcon className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold">Reps Trend</h2>
                  <p className="text-sm text-doom-muted mt-1">Your rep volume over time for the current exercise selection.</p>
                </div>
              </div>
            </div>

            <div className="mb-5 flex flex-wrap gap-2">
              {(["day", "month", "year"] as const).map((granularity) => (
                <button
                  key={granularity}
                  type="button"
                  onClick={() => setTrendGranularity(granularity)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.14em] transition ${
                    trendGranularity === granularity
                      ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-300"
                      : "border-white/8 bg-black/15 text-doom-muted"
                  }`}
                >
                  {granularity}
                </button>
              ))}
            </div>

            <div className="h-[23rem] w-full text-xs md:text-sm">
              {repTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={repTrendData} margin={{ top: 12, right: 8, left: -18, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" vertical={false} />
                    <XAxis dataKey="label" stroke="#a0aec0" tickMargin={10} />
                    <YAxis allowDecimals={false} stroke="#a0aec0" />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#151923", borderColor: "#22d3ee", color: "#e0e6f0" }}
                      formatter={(value) => [`${value} reps`, "Volume"]}
                      labelFormatter={(_, payload) => {
                        const point = payload?.[0]?.payload;
                        return point?.fullLabel || "";
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="reps"
                      stroke="#22d3ee"
                      strokeWidth={3}
                      dot={{ r: 3, fill: "#22d3ee", strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: "#67e8f9", stroke: "#22d3ee", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-doom-muted">
                  No rep trend available for that filter yet.
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Motivational Feed Row */}
        <div className="mt-8">
           <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="bg-doom-surface p-6 md:p-8 rounded-3xl border border-purple-500/20 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                    <Smile className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold">Motivation & Progress</h2>
                </div>
              </div>
              
              <div className="space-y-4">
                {motivationData.length > 0 ? motivationData.map((mood, idx) => (
                  <div key={idx} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-black/30 rounded-2xl border border-white/5 gap-4">
                    <div className="flex items-center gap-4">
                       <div className="flex items-center justify-center w-12 h-12 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30">
                          {mood.rating >= 4 ? <Smile className="w-6 h-6" /> : <Frown className="w-6 h-6" />}
                       </div>
                       <div>
                         <p className="font-semibold text-doom-text flex items-center gap-2">
                           Mood Rating: {mood.rating}/5
                         </p>
                         <p className="text-sm text-doom-muted italic mt-1">"{mood.note}"</p>
                       </div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                       {mood.reps > 0 && <span className="text-sm font-bold text-doom-primary">{mood.reps} Reps Logged</span>}
                       <p suppressHydrationWarning className="text-xs text-doom-muted">{formatMstTimestamp(mood.date)}</p>
                    </div>
                  </div>
                )) : (
                   <div className="p-6 text-center text-doom-muted bg-black/20 rounded-2xl border border-white/5">
                     Log your mood after workouts to see it reflected here!
                   </div>
                )}
              </div>
           </motion.div>
        </div>

      </div>
      <AgentChat userId={userId} />
    </main>
  );
}
