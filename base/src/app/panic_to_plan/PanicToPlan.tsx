'use client';
import { useState } from 'react';

type Task = { title: string; duration?: number; effort?: string };

type Plan = {
  do_now: Task[];
  do_next: Task[];
  defer: Task[];
  tiny_win: Task | null;
  reasoning: string | string[];
  confidence?: number;
  primary_recommendation?: string;
};

type RefinementMode = 'lighter' | 'ambitious' | 'less_time' | null;

export default function PanicToPlan() {
  const [input, setInput] = useState('');
  const [energy, setEnergy] = useState('medium');
  const [stress, setStress] = useState('medium');
  const [time, setTime] = useState(60);
  const [deadline, setDeadline] = useState('');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [refinement, setRefinement] = useState<RefinementMode>(null);
  const [activeChips, setActiveChips] = useState<string[]>([]);

  const toggleChip = (chip: string) => {
    setActiveChips((prev) =>
      prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]
    );
  };

  const getPlan = async (mode: RefinementMode = null) => {
    setLoading(true);
    setRefinement(mode);

    const adjustedTime = mode === 'less_time' ? Math.round(time * 0.6) : time;
    const adjustedEnergy =
      mode === 'lighter' ? 'low' : mode === 'ambitious' ? 'high' : energy;

    try {
      const res = await fetch('/api/panic_to_plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: [input, ...activeChips.map((c) => c.toLowerCase())].filter(Boolean).join(', '),
          energy: adjustedEnergy,
          stress,
          time: adjustedTime,
          deadline,
          refinement: mode,
        }),
      });
      const data = await res.json();
      setPlan(data);
    } catch (err) {
      console.error('Failed to get plan:', err);
    } finally {
      setLoading(false);
    }
  };

  const reasoningLines = Array.isArray(plan?.reasoning)
    ? plan.reasoning
    : plan?.reasoning
    ? [plan.reasoning]
    : [];

  const confidencePct =
    plan?.confidence != null ? Math.round(plan.confidence * 100) : null;

  /* ─── PLAN VIEW ─── */
  if (plan) {
    return (
      <div
        className="min-h-screen p-4 md:p-8"
        style={{ background: 'var(--doom-bg)' }}
      >
        {/* Desktop: 2-col grid. Mobile: single col */}
        <div className="max-w-5xl mx-auto">

          {/* Top bar: title + confidence + reset */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h2
                className="text-2xl font-bold tracking-tight"
                style={{ color: 'var(--doom-text)' }}
              >
                Your Triage Plan
              </h2>
              {confidencePct !== null && (
                <span
                  className="text-xs font-bold px-3 py-1 rounded-full border"
                  style={{
                    color: 'var(--doom-primary)',
                    borderColor: 'var(--doom-primary)',
                    background: 'rgba(0,255,136,0.08)',
                  }}
                >
                  {confidencePct}% confidence
                </span>
              )}
            </div>
            <button
              onClick={() => { setPlan(null); setRefinement(null); setActiveChips([]); }}
              className="text-sm transition px-4 py-2 rounded-lg border"
              style={{
                color: 'rgba(224,230,240,0.4)',
                borderColor: 'rgba(224,230,240,0.1)',
                background: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'rgba(224,230,240,0.7)';
                e.currentTarget.style.borderColor = 'rgba(224,230,240,0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(224,230,240,0.4)';
                e.currentTarget.style.borderColor = 'rgba(224,230,240,0.1)';
              }}
            >
              ← Reset
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">

            {/* ── LEFT COLUMN: Primary actions ── */}
            <div className="space-y-4">

              {/* Plan Summary */}
              {plan.primary_recommendation && (
                <div
                  className="px-5 py-4 rounded-xl border"
                  style={{
                    background: 'var(--doom-surface)',
                    borderColor: 'rgba(0,255,136,0.25)',
                  }}
                >
                  <p
                    className="text-xs font-bold uppercase tracking-widest mb-1"
                    style={{ color: 'var(--doom-primary)' }}
                  >
                    Plan Summary
                  </p>
                  <p
                    className="text-sm font-semibold leading-snug"
                    style={{ color: 'var(--doom-text)' }}
                  >
                    {plan.primary_recommendation}
                  </p>
                </div>
              )}

              {/* Best Next Move — hero card */}
              <div
                className="p-6 rounded-xl border-2"
                style={{
                  background: 'rgba(0,255,136,0.07)',
                  borderColor: 'var(--doom-primary)',
                  boxShadow: '0 0 24px rgba(0,255,136,0.15)',
                }}
              >
                <h3
                  className="text-xs font-bold uppercase tracking-widest mb-2"
                  style={{ color: 'rgba(0,255,136,0.6)' }}
                >
                  Best Next Move
                </h3>
                <p
                  className="text-2xl font-bold leading-tight"
                  style={{ color: 'var(--doom-primary)' }}
                >
                  {plan.do_now?.[0]?.title || 'Take 5 minutes to breathe'}
                </p>
                {plan.do_now?.[0]?.duration && (
                  <span
                    className="mt-3 inline-block text-xs font-semibold rounded-full px-3 py-0.5 border"
                    style={{
                      color: 'var(--doom-primary)',
                      borderColor: 'rgba(0,255,136,0.3)',
                      background: 'rgba(0,255,136,0.1)',
                    }}
                  >
                    ~{plan.do_now[0].duration} min
                  </span>
                )}
              </div>

              {/* Do Now (rest) */}
              {plan.do_now?.length > 1 && (
                <div
                  className="p-4 rounded-xl border space-y-2"
                  style={{
                    background: 'var(--doom-surface)',
                    borderColor: 'rgba(0,255,136,0.15)',
                  }}
                >
                  <h4
                    className="text-xs font-bold uppercase tracking-widest mb-2"
                    style={{ color: 'rgba(0,255,136,0.5)' }}
                  >
                    Do Now
                  </h4>
                  {plan.do_now.slice(1).map((t, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: 'var(--doom-primary)' }}
                      />
                      <span
                        className="text-sm font-medium"
                        style={{ color: 'var(--doom-text)' }}
                      >
                        {t.title}
                      </span>
                      {t.duration && (
                        <span
                          className="ml-auto text-xs"
                          style={{ color: 'rgba(224,230,240,0.3)' }}
                        >
                          {t.duration}m
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Refinement Buttons */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                {(
                  [
                    { mode: 'lighter', label: 'Lighter', color: 'var(--doom-accent)' },
                    { mode: 'ambitious', label: 'Ambitious', color: 'var(--doom-primary)' },
                    { mode: 'less_time', label: 'Less time', color: 'var(--doom-secondary)' },
                  ] as { mode: RefinementMode; label: string; color: string }[]
                ).map(({ mode, label, color }) => (
                  <button
                    key={mode}
                    onClick={() => getPlan(mode)}
                    disabled={loading}
                    className="btn-outline py-2 text-xs font-semibold transition"
                    style={{ color }}
                  >
                    {loading && refinement === mode ? '...' : label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── RIGHT COLUMN: Supporting info ── */}
            <div className="space-y-4">

              {/* After That */}
              {plan.do_next?.length > 0 && (
                <div
                  className="p-4 rounded-xl border space-y-2"
                  style={{
                    background: 'var(--doom-surface)',
                    borderColor: 'rgba(0,217,255,0.15)',
                  }}
                >
                  <h4
                    className="text-xs font-bold uppercase tracking-widest mb-2"
                    style={{ color: 'var(--doom-accent)' }}
                  >
                    After That
                  </h4>
                  {plan.do_next.map((t, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: 'var(--doom-accent)' }}
                      />
                      <span
                        className="text-sm font-medium"
                        style={{ color: 'rgba(224,230,240,0.75)' }}
                      >
                        {t.title}
                      </span>
                      {t.duration && (
                        <span
                          className="ml-auto text-xs"
                          style={{ color: 'rgba(224,230,240,0.3)' }}
                        >
                          {t.duration}m
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Tiny Win */}
              {plan.tiny_win && (
                <div
                  className="p-4 rounded-xl border"
                  style={{
                    background: 'rgba(0,217,255,0.05)',
                    borderColor: 'rgba(0,217,255,0.25)',
                  }}
                >
                  <h4
                    className="text-xs font-bold uppercase tracking-widest mb-1"
                    style={{ color: 'var(--doom-accent)' }}
                  >
                    Tiny Win (if you're stuck)
                  </h4>
                  <p
                    className="text-sm font-semibold"
                    style={{ color: 'var(--doom-text)' }}
                  >
                    {plan.tiny_win.title}
                  </p>
                </div>
              )}

              {/* Skip Today */}
              {plan.defer?.length > 0 && (
                <div
                  className="p-4 rounded-xl border space-y-2"
                  style={{
                    background: 'var(--doom-surface)',
                    borderColor: 'rgba(255,0,68,0.15)',
                  }}
                >
                  <h4
                    className="text-xs font-bold uppercase tracking-widest mb-2"
                    style={{ color: 'rgba(255,0,68,0.6)' }}
                  >
                    Skip Today
                  </h4>
                  {plan.defer.map((t, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: 'rgba(255,0,68,0.4)' }}
                      />
                      <span
                        className="text-sm line-through"
                        style={{ color: 'rgba(224,230,240,0.25)' }}
                      >
                        {t.title}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Reasoning */}
              {reasoningLines.length > 0 && (
                <div
                  className="p-4 rounded-xl border space-y-1"
                  style={{
                    background: 'var(--doom-surface)',
                    borderColor: 'rgba(224,230,240,0.08)',
                  }}
                >
                  <h4
                    className="text-xs font-bold uppercase tracking-widest mb-2"
                    style={{ color: 'rgba(224,230,240,0.3)' }}
                  >
                    Why this plan
                  </h4>
                  {reasoningLines.map((r, i) => (
                    <p
                      key={i}
                      className="text-sm italic"
                      style={{ color: 'rgba(224,230,240,0.45)' }}
                    >
                      • {r}
                    </p>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    );
  }

  /* ─── INPUT VIEW ─── */
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 md:p-8"
      style={{ background: 'var(--doom-bg)' }}
    >
      {/* Desktop: side-by-side. Mobile: stacked */}
      <div className="w-full max-w-5xl">

        {/* On desktop, split into left branding + right form */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-8 items-center">

          {/* ── LEFT: Branding / context panel (desktop only) ── */}
          <div className="hidden md:flex flex-col justify-center pr-4">
            <p
              className="text-base mb-8 max-w-xs leading-relaxed"
              style={{ color: 'rgba(224,230,240,0.45)' }}
            >
              Overwhelmed? Dump everything on your mind. We'll cut through the noise and tell you exactly what to do next.
            </p>

            {/* Feature hints */}
            <div className="space-y-3">
              {[
                'Instant prioritization based on your energy',
                'One clear next action to cut through the fog',
                "Tiny wins for when you're totally stuck",
              ].map((text) => (
                <div key={text} className="flex items-start gap-3">
                  <span
                    className="w-1 h-1 rounded-full mt-2 shrink-0"
                    style={{ background: 'var(--doom-primary)' }}
                  />
                  <p
                    className="text-sm leading-snug"
                    style={{ color: 'rgba(224,230,240,0.35)' }}
                  >
                    {text}
                  </p>
                </div>
              ))}
            </div>

            {/* Decorative glow orb */}
            <div
              className="mt-12 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none"
              style={{ background: 'var(--doom-primary)' }}
            />
          </div>

          {/* ── RIGHT: The actual form ── */}
          <div
            className="rounded-2xl p-6 border"
            style={{
              background: 'var(--doom-surface)',
              borderColor: 'rgba(0,255,136,0.2)',
              boxShadow: '0 0 40px rgba(0,255,136,0.06)',
            }}
          >
            {/* Title — visible on mobile only */}
            <div className="mb-5 md:hidden">
              <h2
                className="text-3xl font-bold tracking-tight"
                style={{ color: 'var(--doom-text)' }}
              >
                Panic{' '}
                <span style={{ color: 'var(--doom-primary)' }}>→</span> Plan
              </h2>
              <p
                className="text-sm mt-1"
                style={{ color: 'rgba(224,230,240,0.4)' }}
              >
                Dump everything. We'll sort it out.
              </p>
            </div>

            {/* Desktop form label */}
            <p
              className="hidden md:block text-xs font-bold uppercase tracking-widest mb-3"
              style={{ color: 'rgba(224,230,240,0.3)' }}
            >
              What's on your mind?
            </p>

            {/* Textarea */}
            <textarea
              className="w-full h-32 p-4 rounded-xl text-sm resize-none transition mb-4 focus:outline-none"
              placeholder="e.g., Need to finish homework, print I-20, buy milk, class in 2 hours, I'm exhausted..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              style={{
                background: 'var(--doom-bg)',
                border: '2px solid rgba(0,255,136,0.2)',
                color: 'var(--doom-text)',
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = 'var(--doom-primary)')
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = 'rgba(0,255,136,0.2)')
              }
            />

            {/* Energy + Stress selectors */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              {[
                {
                  label: 'Energy Level',
                  value: energy,
                  setter: setEnergy,
                  activeColor: 'var(--doom-primary)',
                  activeBg: 'rgba(0,255,136,0.15)',
                  activeText: 'var(--doom-bg)',
                  shadowColor: 'rgba(0,255,136,0.25)',
                },
                {
                  label: 'Stress Level',
                  value: stress,
                  setter: setStress,
                  activeColor: 'var(--doom-secondary)',
                  activeBg: 'var(--doom-secondary)',
                  activeText: 'white',
                  shadowColor: 'rgba(255,0,68,0.25)',
                },
              ].map(({ label, value, setter, activeColor, activeBg, activeText, shadowColor }) => (
                <div key={label}>
                  <label
                    className="text-xs font-bold uppercase tracking-widest block mb-1.5 ml-1"
                    style={{ color: 'rgba(224,230,240,0.35)' }}
                  >
                    {label}
                  </label>
                  <div className="flex gap-1">
                    {['low', 'medium', 'high'].map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => setter(lvl)}
                        className="flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition"
                        style={
                          value === lvl
                            ? {
                                background: activeBg,
                                color: activeText,
                                border: `1px solid ${activeColor}`,
                                boxShadow: `0 0 10px ${shadowColor}`,
                              }
                            : {
                                background: 'var(--doom-bg)',
                                color: 'rgba(224,230,240,0.4)',
                                border: '1px solid rgba(224,230,240,0.1)',
                              }
                        }
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Time + Deadline */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label
                  className="text-xs font-bold uppercase tracking-widest block mb-1.5 ml-1"
                  style={{ color: 'rgba(224,230,240,0.35)' }}
                >
                  Minutes Available
                </label>
                <input
                  type="number"
                  value={time}
                  min={5}
                  onChange={(e) => setTime(Number(e.target.value))}
                  className="w-full rounded-lg text-sm px-3 py-2 focus:outline-none transition"
                  style={{
                    background: 'var(--doom-bg)',
                    border: '2px solid rgba(0,255,136,0.15)',
                    color: 'var(--doom-text)',
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = 'var(--doom-primary)')
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = 'rgba(0,255,136,0.15)')
                  }
                />
              </div>
              <div>
                <label
                  className="text-xs font-bold uppercase tracking-widest block mb-1.5 ml-1"
                  style={{ color: 'rgba(224,230,240,0.35)' }}
                >
                  Hard Deadline (optional)
                </label>
                <input
                  type="text"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  placeholder="e.g., class at 3pm"
                  className="w-full rounded-lg text-sm px-3 py-2 focus:outline-none transition"
                  style={{
                    background: 'var(--doom-bg)',
                    border: '2px solid rgba(0,255,136,0.15)',
                    color: 'var(--doom-text)',
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = 'var(--doom-primary)')
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = 'rgba(0,255,136,0.15)')
                  }
                />
              </div>
            </div>

            {/* Quick chips */}
            <div className="flex flex-wrap gap-2 mb-5">
              {['Low energy', 'Have class soon', "Haven't eaten", 'Need focus', 'Running errands'].map(
                (chip) => (
                  <button
                    key={chip}
                    onClick={() => toggleChip(chip)}
                    className="text-xs px-3 py-1.5 rounded-full transition font-medium"
                    style={
                      activeChips.includes(chip)
                        ? {
                            background: 'rgba(0,255,136,0.15)',
                            border: '1px solid var(--doom-primary)',
                            color: 'var(--doom-primary)',
                          }
                        : {
                            background: 'var(--doom-bg)',
                            border: '1px solid rgba(0,255,136,0.2)',
                            color: 'rgba(0,255,136,0.6)',
                          }
                    }
                    onMouseEnter={(e) => {
                      if (!activeChips.includes(chip)) {
                        e.currentTarget.style.borderColor = 'var(--doom-primary)';
                        e.currentTarget.style.color = 'var(--doom-primary)';
                        e.currentTarget.style.background = 'rgba(0,255,136,0.07)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!activeChips.includes(chip)) {
                        e.currentTarget.style.borderColor = 'rgba(0,255,136,0.2)';
                        e.currentTarget.style.color = 'rgba(0,255,136,0.6)';
                        e.currentTarget.style.background = 'var(--doom-bg)';
                      }
                    }}
                  >
                    {chip}
                  </button>
                )
              )}
            </div>

            {/* Submit */}
            <button
              onClick={() => getPlan(null)}
              disabled={loading || !input.trim()}
              className="btn-primary w-full py-4 rounded-xl font-bold text-base justify-center transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Taming the chaos...' : 'Create My Plan →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}