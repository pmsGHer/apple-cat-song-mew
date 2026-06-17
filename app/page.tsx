"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Cat,
  Drumstick,
  Sparkles,
  HeartHandshake,
  Moon,
  Bell,
  Mic,
  Square,
  Volume2,
  Copy,
  Check,
  Camera,
  Wand2,
  AudioLines,
  RefreshCw,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  타입 정의                                                          */
/* ------------------------------------------------------------------ */

type OscType = "sine" | "square" | "sawtooth" | "triangle";

type MeowNote = {
  at: number; // 시작 오프셋(초)
  startFreq: number;
  peakFreq: number;
  endFreq: number;
  duration: number;
  type?: OscType;
  gain?: number;
};

type Situation = {
  id: string;
  label: string;
  hint: string;
  emoji: string;
  Icon: typeof Cat;
  color: string; // 버튼 배경 tailwind 클래스
  notes: MeowNote[];
};

type Emotion = {
  id: string;
  label: string;
  emoji: string;
  message: string; // "지금 고양이는 ~"
  pitch: number; // 대표 주파수(Hz)
  energy: number; // 대표 에너지(0~1)
  recommend: string[]; // 추천 응대 소리(situation id)
};

type Breed = {
  name: string;
  emoji: string;
  desc: string;
};

type Analysis = {
  emotion: Emotion;
  pitch: number;
  energy: number;
  confidence: number;
  breed: Breed;
  demo: boolean;
};

/* ------------------------------------------------------------------ */
/*  데이터: 상황별 울음소리 프리셋                                      */
/* ------------------------------------------------------------------ */

const SITUATIONS: Situation[] = [
  {
    id: "feed",
    label: "밥 줄 때",
    hint: "재촉하는 냥",
    emoji: "🍚",
    Icon: Drumstick,
    color: "bg-coral",
    notes: [
      { at: 0.0, startFreq: 420, peakFreq: 720, endFreq: 480, duration: 0.32, type: "sawtooth" },
      { at: 0.4, startFreq: 440, peakFreq: 760, endFreq: 500, duration: 0.34, type: "sawtooth" },
      { at: 0.85, startFreq: 400, peakFreq: 640, endFreq: 360, duration: 0.55, type: "sawtooth" },
    ],
  },
  {
    id: "play",
    label: "놀고 싶을 때",
    hint: "들뜬 트릴",
    emoji: "🧶",
    Icon: Sparkles,
    color: "bg-lav",
    notes: [
      { at: 0.0, startFreq: 760, peakFreq: 980, endFreq: 820, duration: 0.16, type: "triangle" },
      { at: 0.2, startFreq: 820, peakFreq: 1040, endFreq: 880, duration: 0.16, type: "triangle" },
      { at: 0.4, startFreq: 700, peakFreq: 1100, endFreq: 760, duration: 0.22, type: "triangle" },
    ],
  },
  {
    id: "greet",
    label: "반가울 때",
    hint: "다정한 냥",
    emoji: "💗",
    Icon: HeartHandshake,
    color: "bg-paw",
    notes: [
      { at: 0.0, startFreq: 600, peakFreq: 900, endFreq: 700, duration: 0.18, type: "triangle" },
      { at: 0.26, startFreq: 520, peakFreq: 820, endFreq: 560, duration: 0.42, type: "sawtooth" },
    ],
  },
  {
    id: "sleepy",
    label: "졸릴 때",
    hint: "나른한 냥",
    emoji: "😴",
    Icon: Moon,
    color: "bg-sky",
    notes: [
      { at: 0.0, startFreq: 360, peakFreq: 460, endFreq: 300, duration: 0.9, type: "sine", gain: 0.22 },
    ],
  },
  {
    id: "attention",
    label: "관심받고 싶을 때",
    hint: "애교 어필",
    emoji: "✨",
    Icon: Bell,
    color: "bg-mint",
    notes: [
      { at: 0.0, startFreq: 520, peakFreq: 760, endFreq: 560, duration: 0.3, type: "triangle" },
      { at: 0.42, startFreq: 560, peakFreq: 820, endFreq: 600, duration: 0.36, type: "triangle" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  데이터: 감정 프로필 (로컬 유사도 분석용)                            */
/* ------------------------------------------------------------------ */

const EMOTIONS: Emotion[] = [
  {
    id: "happy",
    label: "행복 / 만족",
    emoji: "😻",
    message: "지금 기분이 너무 좋아요! 그르릉 행복 모드예요",
    pitch: 760,
    energy: 0.5,
    recommend: ["greet", "play"],
  },
  {
    id: "demand",
    label: "요구 / 배고픔",
    emoji: "🍴",
    message: "배가 고파요! 얼른 뭐 좀 챙겨달라고 말하고 있어요",
    pitch: 470,
    energy: 0.72,
    recommend: ["feed", "attention"],
  },
  {
    id: "complaint",
    label: "불만 / 삐짐",
    emoji: "🙀",
    message: "조금 삐졌어요... 마음에 안 드는 게 있나봐요",
    pitch: 330,
    energy: 0.6,
    recommend: ["attention", "greet"],
  },
  {
    id: "alert",
    label: "경계 / 긴장",
    emoji: "👀",
    message: "경계 중이에요! 낯선 소리나 물건이 있나봐요",
    pitch: 1050,
    energy: 0.85,
    recommend: ["sleepy", "greet"],
  },
  {
    id: "affection",
    label: "애교 / 관심요청",
    emoji: "🐾",
    message: "관심받고 싶어요~ 지금 한창 애교 부리는 중이에요",
    pitch: 620,
    energy: 0.34,
    recommend: ["greet", "attention"],
  },
];

/* ------------------------------------------------------------------ */
/*  데이터: 종류(성향) 추측                                            */
/* ------------------------------------------------------------------ */

function breedFromPitch(pitch: number): Breed {
  if (pitch >= 820) {
    return {
      name: "수다쟁이 샴 고양이 성향",
      emoji: "🗣️",
      desc: "높고 또렷한 고음! 하루 종일 말 걸고 싶어하는 수다쟁이 기질이에요.",
    };
  }
  if (pitch >= 520) {
    return {
      name: "다정한 코리안 숏헤어 성향",
      emoji: "🐈",
      desc: "균형 잡힌 중음역. 사람과 교감을 즐기는 다정하고 무던한 성격이에요.",
    };
  }
  return {
    name: "묵직한 러시안블루 성향",
    emoji: "🐈‍⬛",
    desc: "낮고 묵직한 저음. 조용하지만 속정 깊은 신중파 매력의 소유자예요.",
  };
}

/* ------------------------------------------------------------------ */
/*  로컬 유사도 분석 알고리즘                                          */
/* ------------------------------------------------------------------ */

function matchEmotion(pitch: number, energy: number) {
  let best = EMOTIONS[0];
  let bestScore = -1;
  for (const e of EMOTIONS) {
    const dp = (pitch - e.pitch) / 500; // 주파수 정규화 거리
    const de = (energy - e.energy) / 0.5; // 에너지 정규화 거리
    // 가우시안 유사도(주파수 70% + 에너지 30% 가중)
    const score = Math.exp(-(dp * dp)) * 0.7 + Math.exp(-(de * de)) * 0.3;
    if (score > bestScore) {
      bestScore = score;
      best = e;
    }
  }
  const confidence = Math.min(98, Math.round(45 + bestScore * 55));
  return { emotion: best, confidence };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/* ------------------------------------------------------------------ */
/*  Web Audio: 고양이 울음소리 합성                                    */
/* ------------------------------------------------------------------ */

function playNote(ctx: AudioContext, note: MeowNote, base: number) {
  const t0 = base + note.at;
  const dur = note.duration;
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  const peak = note.gain ?? 0.26;

  osc.type = note.type ?? "sawtooth";
  osc2.type = "triangle";

  // "야-옹" 피치 컨투어: 빠르게 올라갔다 천천히 내려옴
  for (const o of [osc, osc2]) {
    const detune = o === osc2 ? 1.006 : 1;
    o.frequency.setValueAtTime(note.startFreq * detune, t0);
    o.frequency.linearRampToValueAtTime(note.peakFreq * detune, t0 + dur * 0.28);
    o.frequency.linearRampToValueAtTime(note.endFreq * detune, t0 + dur);
  }

  // 비브라토(살짝 떨리는 냥 느낌)
  lfo.frequency.value = 16;
  lfoGain.gain.value = note.peakFreq * 0.018;
  lfo.connect(lfoGain).connect(osc.frequency);

  // 포먼트 느낌의 로우패스
  filter.type = "lowpass";
  filter.Q.value = 7;
  filter.frequency.setValueAtTime(note.peakFreq * 3.2, t0);
  filter.frequency.linearRampToValueAtTime(note.peakFreq * 2.2, t0 + dur);

  // 게인 엔벨로프
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.04);
  gain.gain.setValueAtTime(peak, t0 + dur * 0.55);
  gain.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);

  osc.connect(filter);
  osc2.connect(filter);
  filter.connect(gain).connect(ctx.destination);

  osc.start(t0);
  osc2.start(t0);
  lfo.start(t0);
  const stopAt = t0 + dur + 0.05;
  osc.stop(stopAt);
  osc2.stop(stopAt);
  lfo.stop(stopAt);
}

/* ------------------------------------------------------------------ */
/*  메인 컴포넌트                                                      */
/* ------------------------------------------------------------------ */

export default function Home() {
  const [tab, setTab] = useState<"talk" | "listen">("talk");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [level, setLevel] = useState(0);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [micError, setMicError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const pitchSamples = useRef<number[]>([]);
  const energySamples = useRef<number[]>([]);

  /* ---------- AudioContext 준비(사용자 제스처에서 호출) ---------- */
  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      const W = window as unknown as {
        AudioContext: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      };
      const AC = W.AudioContext || W.webkitAudioContext;
      ctxRef.current = new AC();
    }
    return ctxRef.current;
  }, []);

  /* ---------- 상황별 소리 재생 ---------- */
  const playSituation = useCallback(
    (s: Situation) => {
      const ctx = getCtx();
      void ctx.resume();
      const base = ctx.currentTime + 0.02;
      let total = 0;
      for (const note of s.notes) {
        playNote(ctx, note, base);
        total = Math.max(total, note.at + note.duration);
      }
      setPlayingId(s.id);
      window.setTimeout(() => {
        setPlayingId((cur) => (cur === s.id ? null : cur));
      }, (total + 0.1) * 1000);
    },
    [getCtx]
  );

  /* ---------- 녹음 정리 ---------- */
  const cleanupRecording = useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    rafRef.current = null;
    timerRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  /* ---------- 녹음 종료 & 분석 ---------- */
  const finishListening = useCallback(() => {
    cleanupRecording();
    setIsRecording(false);
    setLevel(0);

    const pitches = pitchSamples.current;
    if (pitches.length < 4) {
      setMicError(
        "소리가 잘 안 들렸어요. 고양이 가까이서 다시 한 번 들려주세요! 🐈"
      );
      return;
    }
    const pitch = Math.round(median(pitches));
    const energy =
      energySamples.current.reduce((a, b) => a + b, 0) /
      energySamples.current.length;
    const { emotion, confidence } = matchEmotion(pitch, energy);
    setAnalysis({
      emotion,
      pitch,
      energy,
      confidence,
      breed: breedFromPitch(pitch),
      demo: false,
    });
  }, [cleanupRecording]);

  /* ---------- 녹음 시작 ---------- */
  const startListening = useCallback(async () => {
    setMicError(null);
    setAnalysis(null);
    setCopied(false);
    pitchSamples.current = [];
    energySamples.current = [];

    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError("이 브라우저는 마이크를 지원하지 않아요. 아래 체험하기를 눌러보세요!");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = getCtx();
      await ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      const buf = new Uint8Array(analyser.frequencyBinCount);
      const minBin = Math.floor((150 * analyser.fftSize) / ctx.sampleRate);
      const maxBin = Math.floor((2000 * analyser.fftSize) / ctx.sampleRate);

      setIsRecording(true);

      const tick = () => {
        analyser.getByteFrequencyData(buf);
        let maxV = 0;
        let maxI = minBin;
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i];
        for (let i = minBin; i <= maxBin && i < buf.length; i++) {
          if (buf[i] > maxV) {
            maxV = buf[i];
            maxI = i;
          }
        }
        const energy = sum / buf.length / 255;
        setLevel(energy);
        if (maxV > 80) {
          pitchSamples.current.push((maxI * ctx.sampleRate) / analyser.fftSize);
          energySamples.current.push(energy);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      timerRef.current = window.setTimeout(() => finishListening(), 3200);
    } catch {
      cleanupRecording();
      setIsRecording(false);
      setMicError(
        "마이크 권한이 필요해요. 권한을 허용하거나 아래 '마이크 없이 체험하기'를 눌러보세요!"
      );
    }
  }, [getCtx, finishListening, cleanupRecording]);

  /* ---------- 마이크 없이 체험(데모) ---------- */
  const runDemo = useCallback(() => {
    setMicError(null);
    setCopied(false);
    const pitch = Math.round(300 + Math.random() * 800);
    const energy = 0.25 + Math.random() * 0.6;
    const { emotion, confidence } = matchEmotion(pitch, energy);
    setAnalysis({
      emotion,
      pitch,
      energy,
      confidence,
      breed: breedFromPitch(pitch),
      demo: true,
    });
  }, []);

  /* ---------- 결과 텍스트 & 공유 ---------- */
  const shareText = analysis
    ? `🐱 애플이의 냥냥 토크 결과 🐱\n` +
      `지금 우리 고양이는 "${analysis.emotion.message}"\n` +
      `🎵 감정: ${analysis.emotion.label} ${analysis.emotion.emoji} (정확도 ${analysis.confidence}%)\n` +
      `🐾 성향: ${analysis.breed.emoji} ${analysis.breed.name}\n` +
      `#애플이 #냥냥토크 #고양이언어 #집사일상`
    : "";

  const copyResult = useCallback(async () => {
    if (!shareText) return;
    try {
      await navigator.clipboard.writeText(shareText);
    } catch {
      // 클립보드 API가 막힌 환경 대비
      const ta = document.createElement("textarea");
      ta.value = shareText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }, [shareText]);

  /* ---------- 언마운트 정리 ---------- */
  useEffect(() => {
    return () => {
      cleanupRecording();
      void ctxRef.current?.close();
    };
  }, [cleanupRecording]);

  const recommended = analysis
    ? SITUATIONS.filter((s) => analysis.emotion.recommend.includes(s.id))
    : [];

  /* ================================================================ */
  /*  렌더링                                                          */
  /* ================================================================ */

  return (
    <main className="flex flex-1 items-center justify-center p-3 sm:p-5">
      <div className="flex w-full max-w-md flex-col rounded-[28px] border border-white/70 bg-white/70 p-4 shadow-[0_20px_60px_-20px_rgba(247,163,153,0.55)] backdrop-blur-md sm:p-6">
        {/* 헤더 */}
        <header className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-coral text-white shadow-md">
            <Cat className="h-7 w-7" strokeWidth={2.2} />
          </div>
          <div className="leading-tight">
            <h1 className="text-lg font-extrabold text-cocoa">
              애플이의 냥냥 토크
            </h1>
            <p className="text-xs font-semibold text-cocoa/60">
              고양이와 대화하고 마음을 읽어봐요 🐾
            </p>
          </div>
        </header>

        {/* 탭 */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-peach/50 p-1.5">
          <TabButton
            active={tab === "talk"}
            onClick={() => setTab("talk")}
            icon={<Volume2 className="h-4 w-4" />}
            label="말 걸기"
          />
          <TabButton
            active={tab === "listen"}
            onClick={() => setTab("listen")}
            icon={<Mic className="h-4 w-4" />}
            label="소리 듣기"
          />
        </div>

        {/* ---------------- 말 걸기 탭 ---------------- */}
        {tab === "talk" && (
          <section className="mt-4 animate-pop">
            <p className="mb-3 text-center text-sm font-bold text-cocoa/70">
              상황을 골라 고양이에게 말을 걸어보세요!
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {SITUATIONS.map((s) => {
                const isOn = playingId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => playSituation(s)}
                    className={`group relative flex flex-col items-start gap-1 rounded-2xl ${s.color} p-3 text-left text-cocoa shadow-sm ring-1 ring-white/50 transition active:scale-95 ${
                      isOn ? "scale-[1.03] ring-2 ring-coral" : "hover:-translate-y-0.5"
                    } ${s.id === "attention" ? "col-span-2" : ""}`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-2xl">{s.emoji}</span>
                      <s.Icon
                        className={`h-5 w-5 text-cocoa/55 ${isOn ? "animate-wiggle" : ""}`}
                      />
                    </div>
                    <span className="text-sm font-extrabold leading-tight">
                      {s.label}
                    </span>
                    <span className="text-[11px] font-semibold text-cocoa/55">
                      {isOn ? "재생 중… 🔊" : s.hint}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 flex items-center justify-center gap-1 text-center text-[11px] font-semibold text-cocoa/45">
              <AudioLines className="h-3.5 w-3.5" />
              모든 소리는 브라우저에서 실시간 합성돼요(무료·오프라인)
            </p>
          </section>
        )}

        {/* ---------------- 소리 듣기 탭 ---------------- */}
        {tab === "listen" && (
          <section className="mt-4 animate-pop">
            {/* 녹음 버튼 / 비주얼라이저 */}
            <div className="flex flex-col items-center rounded-2xl bg-gradient-to-b from-peach/40 to-white/30 p-4">
              <Visualizer level={level} active={isRecording} />
              {!isRecording ? (
                <button
                  onClick={startListening}
                  className="mt-3 flex items-center gap-2 rounded-full bg-coral px-6 py-3 text-sm font-extrabold text-white shadow-md transition active:scale-95 hover:bg-paw"
                >
                  <Mic className="h-5 w-5" />
                  고양이 소리 듣기
                </button>
              ) : (
                <button
                  onClick={finishListening}
                  className="mt-3 flex items-center gap-2 rounded-full bg-cocoa px-6 py-3 text-sm font-extrabold text-white shadow-md transition active:scale-95"
                >
                  <Square className="h-4 w-4 fill-white" />
                  지금 분석하기
                </button>
              )}
              <p className="mt-2 text-center text-[11px] font-semibold text-cocoa/55">
                {isRecording
                  ? "고양이 소리를 들려주세요… (약 3초간 자동 분석)"
                  : "버튼을 누르고 고양이 울음소리를 들려주세요"}
              </p>
            </div>

            {/* 에러 / 데모 */}
            {micError && (
              <div className="mt-3 rounded-2xl bg-lav/60 p-3 text-center text-xs font-semibold text-cocoa">
                {micError}
                <button
                  onClick={runDemo}
                  className="mx-auto mt-2 flex items-center gap-1.5 rounded-full bg-cocoa px-4 py-2 text-xs font-bold text-white"
                >
                  <Wand2 className="h-3.5 w-3.5" />
                  마이크 없이 체험하기
                </button>
              </div>
            )}

            {/* 분석 결과 */}
            {analysis && (
              <div className="mt-3 animate-pop rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-peach/60">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{analysis.emotion.emoji}</span>
                  <div className="flex-1">
                    <p className="text-sm font-extrabold text-cocoa">
                      지금 고양이는{" "}
                      <span className="text-paw">
                        “{analysis.emotion.label}”
                      </span>{" "}
                      상태!
                    </p>
                    <p className="mt-0.5 text-xs font-semibold leading-snug text-cocoa/70">
                      {analysis.emotion.message}
                    </p>
                  </div>
                </div>

                {/* 정확도 바 */}
                <div className="mt-3">
                  <div className="flex justify-between text-[11px] font-bold text-cocoa/60">
                    <span>분석 정확도</span>
                    <span>{analysis.confidence}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-peach/50">
                    <div
                      className="h-full rounded-full bg-coral transition-all duration-700"
                      style={{ width: `${analysis.confidence}%` }}
                    />
                  </div>
                </div>

                {/* 종류(성향) */}
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-sky/40 p-2.5">
                  <span className="text-xl">{analysis.breed.emoji}</span>
                  <div>
                    <p className="text-xs font-extrabold text-cocoa">
                      {analysis.breed.name}
                    </p>
                    <p className="text-[11px] font-semibold leading-snug text-cocoa/65">
                      {analysis.breed.desc}{" "}
                      <span className="text-cocoa/45">
                        (피치 {analysis.pitch}Hz)
                      </span>
                    </p>
                  </div>
                </div>

                {/* 추천 응대 소리 */}
                {recommended.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-xs font-extrabold text-cocoa">
                      💬 이렇게 답해주면 좋아요
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {recommended.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => playSituation(s)}
                          className={`flex items-center gap-1.5 rounded-full ${s.color} px-3 py-2 text-xs font-bold text-cocoa shadow-sm ring-1 ring-white/50 transition active:scale-95 ${
                            playingId === s.id ? "ring-2 ring-coral" : ""
                          }`}
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                          {s.emoji} {s.label} 소리
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 공유 */}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={copyResult}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-cocoa px-3 py-2.5 text-xs font-extrabold text-white transition active:scale-95"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4" /> 복사됐어요!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" /> 결과 텍스트 복사
                      </>
                    )}
                  </button>
                  <a
                    href="https://www.instagram.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-paw to-lav px-3 py-2.5 text-xs font-extrabold text-white transition active:scale-95"
                  >
                    <Camera className="h-4 w-4" /> 인스타에 자랑
                  </a>
                </div>

                <button
                  onClick={startListening}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full bg-peach/60 px-3 py-2 text-xs font-bold text-cocoa/70 transition active:scale-95"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> 다시 듣기
                </button>

                {analysis.demo && (
                  <p className="mt-2 text-center text-[10px] font-semibold text-cocoa/40">
                    * 마이크 없이 진행한 체험용 결과예요
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        <footer className="mt-4 text-center text-[10px] font-semibold text-cocoa/35">
          🐱 애플이 전용 · 100% 프론트엔드 · 외부 API 없음
        </footer>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  하위 컴포넌트                                                      */
/* ------------------------------------------------------------------ */

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-extrabold transition ${
        active
          ? "bg-white text-coral shadow-sm"
          : "text-cocoa/55 hover:text-cocoa"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Visualizer({ level, active }: { level: number; active: boolean }) {
  const bars = 7;
  return (
    <div className="flex h-16 items-end justify-center gap-1.5">
      {Array.from({ length: bars }).map((_, i) => {
        const center = Math.abs(i - (bars - 1) / 2);
        const factor = 1 - center / bars;
        const h = active
          ? 8 + level * 220 * (0.5 + factor) + (i % 2) * 6
          : 8;
        return (
          <span
            key={i}
            className={`w-2.5 rounded-full transition-all duration-100 ${
              active ? "bg-coral" : "bg-peach"
            }`}
            style={{ height: `${Math.min(64, h)}px` }}
          />
        );
      })}
    </div>
  );
}
