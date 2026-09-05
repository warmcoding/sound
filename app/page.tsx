'use client';

import { useState, useRef, useCallback } from 'react';

// 定义 6 声道结构
interface Track {
  id: string;
  name: string;
  url: string;
  volume: number;
  isMuted: boolean;
  isPlaying: boolean; // 🆕 单轨播放状态
}

// 定义和弦结构 (时间戳 + 和弦)
interface ChordItem {
  time: number; // 开始时间（秒）
  chord: string; // 和弦名称
}

const DEFAULT_TRACKS = [
  { id: 'vocals', name: '🎤 人声 (Vocals)', file: 'vocals.wav' },
  { id: 'guitar', name: '🎸 吉他 (Guitar)', file: 'guitar.wav' },
  { id: 'bass', name: '🎸 贝斯 (Bass)', file: 'bass.wav' },
  { id: 'drums', name: '🥁 爵士鼓 (Drums)', file: 'drums.wav' },
  { id: 'piano', name: '🎹 钢琴 (Piano)', file: 'piano.wav' },
  { id: 'other', name: '🎼 其他 (Other)', file: 'other.wav' },
];

// 🎸 Mock 的 chords.json 识别数据
const MOCK_CHORDS: ChordItem[] = [
  { time: 0, chord: 'C' },
  { time: 4, chord: 'G' },
  { time: 8, chord: 'Am' },
  { time: 12, chord: 'Em' },
  { time: 16, chord: 'F' },
  { time: 20, chord: 'C' },
  { time: 24, chord: 'Dm7' },
  { time: 28, chord: 'G7' },
];

export default function Home() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // 🆕 多轨与播放时间状态
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [chords, setChords] = useState<ChordItem[]>([]);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({});

  // 处理文件上传选择
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('audio/')) {
      alert('请上传音频文件！');
      return;
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioFile(file);
    setAudioUrl(URL.createObjectURL(file));
    setStatusMsg('');
    setTracks([]);
    setIsPlayingAll(false);
  }, [audioUrl]);

  const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) handleFile(e.target.files[0]);
  };

  // 🚀 本地测试模式：载入预设音轨与和弦数据
  const handleStartSeparation = async () => {
    setIsProcessing(true);
    setStatusMsg('🎵 本地演示模式：正在载入音轨与和弦数据...');

    setTimeout(() => {
      const loadedTracks: Track[] = DEFAULT_TRACKS.map((t) => ({
        id: t.id,
        name: t.name,
        url: `/demo-tracks/${t.file}`,
        volume: 0.8,
        isMuted: false,
        isPlaying: false,
      }));

      setTracks(loadedTracks);
      setChords(MOCK_CHORDS);
      setStatusMsg('✅ 音轨与和弦识别加载成功！已进入跟弹模式');
      setIsProcessing(false);
    }, 1200);
  };

  // 🎵 1. 全局：同步播放 / 暂停全部 6 轨
  const togglePlayAll = () => {
    const nextState = !isPlayingAll;
    setIsPlayingAll(nextState);

    setTracks((prev) => prev.map((t) => ({ ...t, isPlaying: nextState })));

    tracks.forEach((track) => {
      const audio = audioRefs.current[track.id];
      if (audio) {
        if (nextState) {
          audio.volume = track.isMuted ? 0 : track.volume;
          audio.play().catch((err) => console.error('播放拦截:', err));
        } else {
          audio.pause();
        }
      }
    });
  };

  // 🎵 2. 单轨：独立控制单个音轨播放 / 暂停
  const togglePlaySingleTrack = (id: string) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const nextPlaying = !t.isPlaying;
          const audio = audioRefs.current[id];
          if (audio) {
            if (nextPlaying) {
              audio.volume = t.isMuted ? 0 : t.volume;
              audio.play().catch((err) => console.error('播放拦截:', err));
            } else {
              audio.pause();
            }
          }
          return { ...t, isPlaying: nextPlaying };
        }
        return t;
      })
    );
  };

  // 🎚️ 3. 全局 Seek 进度跳转（所有 6 轨同步对齐）
  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime);
    tracks.forEach((track) => {
      const audio = audioRefs.current[track.id];
      if (audio) {
        audio.currentTime = newTime;
      }
    });
  };

  // ⏱️ 4. 实时监听时间变化
  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    if (audio && !isNaN(audio.currentTime)) {
      setCurrentTime(audio.currentTime);
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    }
  };

  // 🎚️ 调整单个音轨音量
  const handleVolumeChange = (id: string, newVolume: number) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, volume: newVolume } : t))
    );
    const audio = audioRefs.current[id];
    if (audio) audio.volume = newVolume;
  };

  // 🔇 单轨静音（Mute）
  const toggleMute = (id: string) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const nextMute = !t.isMuted;
          const audio = audioRefs.current[id];
          if (audio) audio.muted = nextMute;
          return { ...t, isMuted: nextMute };
        }
        return t;
      })
    );
  };

  // 格式化时间 (秒 -> 00:00)
  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return '00:00';
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // 🔍 获得当前时刻正在生效的和弦
  const getCurrentChordIndex = () => {
    for (let i = chords.length - 1; i >= 0; i--) {
      if (currentTime >= chords[i].time) {
        return i;
      }
    }
    return 0;
  };

  const activeChordIdx = getCurrentChordIndex();

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black p-4 min-h-screen">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center gap-8 py-12 px-8 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl">
        <h1 className="text-3xl font-bold text-zinc-800 dark:text-white">
          Sound Studio ..
        </h1>

        {/* 上传区域 */}
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`w-full h-36 flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer transition-all ${isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400'
            }`}
        >
          <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileSelect} className="hidden" />
          <p className="text-base font-medium text-zinc-600 dark:text-zinc-300">
            {isDragging ? '松开鼠标上传' : '拖拽音频文件到这里，或点击选择'}
          </p>
        </div>

        {/* 原音频操作区 */}
        {audioUrl && (
          <div className="w-full flex flex-col gap-3">
            <p className="text-xs text-zinc-400 truncate">当前文件: {audioFile?.name}</p>
            <button
              onClick={handleStartSeparation}
              disabled={isProcessing}
              className={`w-full py-3 rounded-lg text-base font-semibold transition-all ${isProcessing ? 'bg-zinc-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg'
                }`}
            >
              {isProcessing ? '拆分与识别中...' : '🚀 开始 6 轨拆分与和弦跟弹 (测试)'}
            </button>
            {statusMsg && (
              <div className="text-center p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                {statusMsg}
              </div>
            )}
          </div>
        )}

        {/* 🎛️ 多轨控制台 + 和弦跟弹区 */}
        {tracks.length > 0 && (
          <div className="w-full flex flex-col gap-6 border-t border-zinc-200 dark:border-zinc-800 pt-6">

            {/* 1. 🎸 实时和弦跟弹卡片区 (Chord Sheet) */}
            <div className="flex flex-col gap-3 bg-zinc-900 text-white p-5 rounded-2xl shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400 tracking-wider uppercase">
                  🎸 实时跟弹和弦 (Chord Sheet)
                </span>
                <span className="text-xs text-emerald-400 font-mono">
                  当前和弦: {chords[activeChordIdx]?.chord || '--'}
                </span>
              </div>

              {/* 横向滚动和弦卡片 */}
              <div className="flex items-center gap-3 overflow-x-auto py-2 no-scrollbar">
                {chords.map((item, index) => {
                  const isActive = index === activeChordIdx;
                  return (
                    <div
                      key={index}
                      onClick={() => handleSeek(item.time)}
                      className={`flex flex-col items-center justify-center min-w-[70px] h-20 rounded-xl cursor-pointer transition-all ${isActive
                        ? 'bg-blue-600 text-white scale-105 shadow-lg shadow-blue-500/50 ring-2 ring-blue-400'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                        }`}
                    >
                      <span className="text-2xl font-black">{item.chord}</span>
                      <span className="text-[10px] opacity-70 font-mono mt-1">
                        {formatTime(item.time)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. 🎚️ 全局进度条 (Timeline / Seek) */}
            <div className="flex flex-col gap-2 bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700/50">
              <div className="flex items-center justify-between text-xs font-mono text-zinc-500">
                <span>{formatTime(currentTime)}</span>
                <button
                  onClick={togglePlayAll}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-full shadow-md transition-all text-sm"
                >
                  {isPlayingAll ? '⏸️ 暂停全部' : '▶️ 同步播放全部'}
                </button>
                <span>{formatTime(duration)}</span>
              </div>

              {/* 拖拽进度条 */}
              <input
                type="range"
                min="0"
                max={duration || 100}
                step="0.1"
                value={currentTime}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {/* 3. 🎚️ 6 轨 Mixer 声道推子（含单轨控制按钮） */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tracks.map((track) => (
                <div
                  key={track.id}
                  className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 flex flex-col gap-3"
                >
                  <audio
                    ref={(el) => { audioRefs.current[track.id] = el; }}
                    src={track.url}
                    preload="auto"
                    onTimeUpdate={track.id === 'vocals' ? handleTimeUpdate : undefined}
                    onEnded={() => {
                      setTracks((prev) =>
                        prev.map((t) => (t.id === track.id ? { ...t, isPlaying: false } : t))
                      );
                    }}
                  />

                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-zinc-700 dark:text-zinc-200">
                      {track.name}
                    </span>

                    {/* 🆕 右侧控制按钮组：单轨播放 + 静音 */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => togglePlaySingleTrack(track.id)}
                        className={`text-xs px-2.5 py-1 rounded font-medium transition-all ${track.isPlaying
                          ? 'bg-amber-500 text-white'
                          : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-300'
                          }`}
                      >
                        {track.isPlaying ? '⏸️ 暂停' : '▶️ 播放'}
                      </button>

                      <button
                        onClick={() => toggleMute(track.id)}
                        className={`text-xs px-2.5 py-1 rounded font-medium transition-all ${track.isMuted
                          ? 'bg-red-500 text-white'
                          : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                          }`}
                      >
                        {track.isMuted ? '已静音' : 'Mute'}
                      </button>
                    </div>
                  </div>

                  {/* 音量滑块 */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-400">🔈</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={track.isMuted ? 0 : track.volume}
                      onChange={(e) => handleVolumeChange(track.id, parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-zinc-300 dark:bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <span className="text-xs text-zinc-400">🔊</span>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}
      </main>
    </div>
  );
}