'use client';

import { useState, useRef, useCallback } from 'react';

// 定义 6 声道结构
interface Track {
  id: string;
  name: string;
  url: string;
  volume: number; // 0 到 1
  isMuted: boolean;
}

const DEFAULT_TRACKS = [
  { id: 'vocals', name: '🎤 人声 (Vocals)', file: 'vocals.wav' },
  { id: 'guitar', name: '🎸 吉他 (Guitar)', file: 'guitar.wav' },
  { id: 'bass', name: '🎸 贝斯 (Bass)', file: 'bass.wav' },
  { id: 'drums', name: '🥁 爵士鼓 (Drums)', file: 'drums.wav' },
  { id: 'piano', name: '🎹 钢琴 (Piano)', file: 'piano.wav' },
  { id: 'other', name: '🎼 其他 (Other)', file: 'other.wav' },
];

export default function Home() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // 🆕 多轨播放控制状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [tracks, setTracks] = useState<Track[]>([]);
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
    setTracks([]); // 清空之前的多轨
    setIsPlaying(false);
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

  // 🚀 本地测试模式：不调用后端 API，直接加载 public/demo-tracks/ 下的文件
  const handleStartSeparation = async () => {
    setIsProcessing(true);
    setStatusMsg('🎵 本地演示模式：正在载入 public/demo-tracks 预设音轨...');

    // 模拟 1.5 秒的 AI 运算等待效果
    setTimeout(() => {
      const loadedTracks: Track[] = DEFAULT_TRACKS.map((t) => ({
        id: t.id,
        name: t.name,
        // 如果您的文件是 .wav 格式，请把下方的 .mp3 改成 .wav
        url: `/demo-tracks/${t.file}`,
        volume: 0.8,
        isMuted: false,
      }));

      setTracks(loadedTracks);
      setStatusMsg('✅ 音轨加载完成！已载入 6 轨 Mixer 混音控制台');
      setIsProcessing(false);
    }, 1500);
  };

  // 🎵 播放 / 暂停控制（支持 6 轨同步对齐）
  const togglePlayAll = () => {
    const nextPlayingState = !isPlaying;
    setIsPlaying(nextPlayingState);

    Object.values(audioRefs.current).forEach((audio) => {
      if (audio) {
        if (nextPlayingState) {
          audio.currentTime = 0; // 强制从头播放以确保 6 轨绝对零延迟对齐
          audio.play();
        } else {
          audio.pause();
        }
      }
    });
  };

  // 🎚️ 调整单个音轨的音量
  const handleVolumeChange = (id: string, newVolume: number) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, volume: newVolume } : t))
    );
    const audio = audioRefs.current[id];
    if (audio) {
      audio.volume = newVolume;
    }
  };

  // 🔇 单轨静音/取消静音（Mute）
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

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black p-4 min-h-screen">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center gap-8 py-12 px-8 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl">
        <h1 className="text-3xl font-bold text-zinc-800 dark:text-white">
          Sound Studio
        </h1>

        {/* 上传区域 */}
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`w-full h-40 flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer transition-all ${isDragging
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
              {isProcessing ? '加载中...' : '🚀 开始 6 轨拆分 (测试)'}
            </button>
            {statusMsg && (
              <div className="text-center p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                {statusMsg}
              </div>
            )}
          </div>
        )}

        {/* 🎚️ 6 轨 Mixer 多轨混音控制台 */}
        {tracks.length > 0 && (
          <div className="w-full flex flex-col gap-6 mt-4 border-t border-zinc-200 dark:border-zinc-800 pt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-800 dark:text-white">
                🎛️ 多轨 Mixer 控制台
              </h2>
              {/* 总播放 / 暂停按钮 */}
              <button
                onClick={togglePlayAll}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-full shadow-md transition-all"
              >
                {isPlaying ? '⏸️ 暂停全部' : '▶️ 同步播放全部'}
              </button>
            </div>

            {/* 6 音轨列表 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tracks.map((track) => (
                <div
                  key={track.id}
                  className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 flex flex-col gap-3"
                >
                  {/* HTML5 Audio 标签 */}
                  <audio
                    ref={(el) => { audioRefs.current[track.id] = el; }}
                    src={track.url}
                    preload="auto"
                  />

                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-zinc-700 dark:text-zinc-200">
                      {track.name}
                    </span>
                    <button
                      onClick={() => toggleMute(track.id)}
                      className={`text-xs px-2.5 py-1 rounded font-medium transition-all ${track.isMuted
                        ? 'bg-red-500 text-white'
                        : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                        }`}
                    >
                      {track.isMuted ? '已静音 Muted' : 'Mute'}
                    </button>
                  </div>

                  {/* 音量滑块推子 */}
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