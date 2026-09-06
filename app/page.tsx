'use client';
import { createClient } from '@supabase/supabase-js';
import { useState, useRef, useCallback, useEffect } from 'react';

const SUPABASE_URL = "https://teuhgretiiawyjtkuzkh.supabase.co"
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRldWhncmV0aWlhd3lqdGt1emtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MzE1OTUsImV4cCI6MjEwNDAwNzU5NX0.ElBYECVaWA0SLLWgSHgI7zaDFNdrG15DEkZ2U3RU7iA"
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const MODAL_ENDPOINT = "https://warmcoding--guitar-chord-separator-trigger-process.modal.run"

// 定义 6 声道结构
interface Track {
  id: string;
  name: string;
  url: string;
  volume: number;
  isMuted: boolean;
  isPlaying: boolean;
}

// 定义和弦结构 (时间戳 + 和弦)
interface ChordItem {
  time: number;
  chord: string;
}

// 定义历史作品记录结构
interface HistoryItem {
  id: string;
  file_name: string;
  task_id: string; // 👈 对应后端生成的任务ID，用于拼装下载直链
  created_at: string;
  status: string;
}

const DEFAULT_TRACK_CONFIGS = [
  { id: 'vocals', name: '🎤 人声 (Vocals)', file: 'vocals.mp3' },
  { id: 'guitar', name: '🎸 吉他 (Guitar)', file: 'guitar.mp3' },
  { id: 'bass', name: '🎸 贝斯 (Bass)', file: 'bass.mp3' },
  { id: 'drums', name: '🥁 爵士鼓 (Drums)', file: 'drums.mp3' },
  { id: 'piano', name: '🎹 钢琴 (Piano)', file: 'piano.mp3' },
  { id: 'other', name: '🎼 其他 (Other)', file: 'other.mp3' },
];

export default function Home() {
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // 👤 用户认证与额度状态
  const [user, setUser] = useState<any>(null);
  const [userCredits, setUserCredits] = useState<number | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // 📂 我的作品历史记录状态与展开项 ID
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // 💰 次数耗尽充值弹窗状态
  const [showPricingModal, setShowPricingModal] = useState(false);

  // 多轨与播放时间状态
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [chords, setChords] = useState<ChordItem[]>([]);
  const audioRefs = useRef<{ [key: string]: HTMLAudioElement | null }>({});

  // 获取用户剩余额度函数
  const fetchUserCredits = async (userId: string) => {
    const { data } = await supabase
      .from('user_credits')
      .select('credits')
      .eq('id', userId)
      .maybeSingle();

    if (data) {
      setUserCredits(data.credits);
    }
  };

  // 获取用户的历史作品记录函数
  const fetchUserHistory = async (userEmail: string) => {
    const { data, error } = await supabase
      .from('user_history')
      .select('*')
      .eq('user_email', userEmail)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setHistoryList(data);
    }
  };

  // 1. 初始化检查登录状态并加载额度与历史记录
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setUser(user);
      if (user) {
        await fetchUserCredits(user.id);
        if (user.email) await fetchUserHistory(user.email);
      }
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await fetchUserCredits(currentUser.id);
        if (currentUser.email) await fetchUserHistory(currentUser.email);
      } else {
        setUserCredits(null);
        setHistoryList([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 🚀 Google 快捷登录函数
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
  };

  // 🚪 登出函数
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserCredits(null);
    setHistoryList([]);
  };

  // 💳 Stripe 结账跳转函数
  const handleCheckout = async (priceId: string) => {
    if (!user) {
      alert('请先登录！');
      return;
    }
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId, userId: user.id }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      alert(data.error || '创建支付订单失败');
    }
  };

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

    if (userCredits !== null && userCredits <= 0) {
      setShowPricingModal(true);
      return;
    }

    if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) handleFile(e.target.files[0]);
  };

  // 轮询检查 Modal 异步处理结果
  const pollForResults = (currentTaskId: string) => {
    return new Promise<ChordItem[]>((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 120;

      const interval = setInterval(async () => {
        attempts++;
        setStatusMsg(`[3/3] Modal GPU 正在后台进行 6 轨拆分与和弦识别... (已等待 ${attempts * 3} 秒)`);

        const { data, error } = await supabase.storage
          .from('separated-tracks')
          .download(`results/${currentTaskId}/chords.json`);

        if (data && !error) {
          clearInterval(interval);
          const text = await data.text();
          resolve(JSON.parse(text));
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(new Error('处理超时，请前往 Modal 仪表盘检查日志'));
        }
      }, 3000);
    });
  };

  // 🚀 核心真实业务流程
  const handleStartSeparation = async () => {
    if (!user) {
      alert('请先使用 Google 账号快捷登录（新用户自动赠送 2 次免费体验）！');
      handleGoogleLogin();
      return;
    }

    if (userCredits === null || userCredits <= 0) {
      setShowPricingModal(true);
      return;
    }

    if (!audioFile) {
      alert('请先选择或拖拽音频文件！');
      return;
    }

    setIsProcessing(true);
    setStatusMsg('[0/3] 正在扣除 1 次使用额度...');

    try {
      const newCredits = userCredits - 1;
      const { error: updateError } = await supabase
        .from('user_credits')
        .update({ credits: newCredits, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (updateError) throw new Error(`扣除额度失败: ${updateError.message}`);
      setUserCredits(newCredits);

      setStatusMsg('[1/3] 额度扣除成功！正在上传原音频到 Supabase 云端存储...');

      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 7);
      const filename = `${timestamp}_${randomStr}.mp3`;
      const currentTaskId = `${timestamp}_${randomStr}`;

      const { error: uploadError } = await supabase.storage
        .from('original-audio')
        .upload(`uploads/${filename}`, audioFile, {
          contentType: audioFile.type || 'audio/mpeg',
          upsert: true,
        });

      if (uploadError) throw new Error(`上传失败: ${uploadError.message}`);

      setStatusMsg('[2/3] 上传成功！正在调起 Modal 云端 GPU 异步处理...');

      const res = await fetch(MODAL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, task_id: currentTaskId }),
      });

      if (!res.ok) throw new Error('调起 Modal 失败');

      const chordData = await pollForResults(currentTaskId);
      setChords(chordData);

      const loadedTracks: Track[] = DEFAULT_TRACK_CONFIGS.map((t) => {
        const { data } = supabase.storage
          .from('separated-tracks')
          .getPublicUrl(`results/${currentTaskId}/${t.file}`);

        return {
          id: t.id,
          name: t.name,
          url: data?.publicUrl || '',
          volume: 0.8,
          isMuted: false,
          isPlaying: false,
        };
      });

      setTracks(loadedTracks);

      // 📥 处理完成后自动向 `user_history` 表插入记录（带 task_id）
      if (user.email) {
        const { error: historyError } = await supabase.from('user_history').insert([
          {
            user_email: user.email,
            file_name: audioFile.name,
            task_id: currentTaskId,
            status: 'success'
          }
        ]);
        if (!historyError) {
          fetchUserHistory(user.email); // 刷新历史记录列表
        }
      }

      setStatusMsg('🎉 音轨拆分与和弦识别完成！已进入跟弹模式');
    } catch (err: any) {
      console.error(err);
      setStatusMsg(`❌ 发生错误: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 辅助函数：根据历史记录的 task_id 获取特定分轨或和弦的下载链接
  const getTrackDownloadUrl = (taskId: string, fileName: string) => {
    if (!taskId) return '#';
    const { data } = supabase.storage
      .from('separated-tracks')
      .getPublicUrl(`results/${taskId}/${fileName}`);
    return data.publicUrl;
  };

  const getChordDownloadUrl = (taskId: string) => {
    if (!taskId) return '#';
    const { data } = supabase.storage
      .from('separated-tracks')
      .getPublicUrl(`results/${taskId}/chords.json`);
    return data.publicUrl;
  };

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

  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime);
    tracks.forEach((track) => {
      const audio = audioRefs.current[track.id];
      if (audio) {
        audio.currentTime = newTime;
      }
    });
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const audio = e.currentTarget;
    if (audio && !isNaN(audio.currentTime)) {
      setCurrentTime(audio.currentTime);
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    }
  };

  const handleVolumeChange = (id: string, newVolume: number) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, volume: newVolume } : t))
    );
    const audio = audioRefs.current[id];
    if (audio) audio.volume = newVolume;
  };

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

  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return '00:00';
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getCurrentChordIndex = () => {
    if (!chords.length) return 0;
    for (let i = chords.length - 1; i >= 0; i--) {
      if (currentTime >= chords[i].time) {
        return i;
      }
    }
    return 0;
  };

  const activeChordIdx = getCurrentChordIndex();

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black p-4 min-h-screen relative">
      {/* 顶部导航条 */}
      <div className="w-full max-w-3xl flex justify-between items-center mb-4 px-2">
        <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">🎸 AI 音乐云端拆分与跟弹</span>
        <div>
          {authLoading ? (
            <span className="text-xs text-zinc-400">加载中...</span>
          ) : user ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-emerald-500 font-medium truncate max-w-[160px]">
                👤 {user.email || user.user_metadata?.full_name || '已登录'}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-md bg-blue-900/40 text-blue-300 font-mono border border-blue-700/50">
                剩余次数: {userCredits !== null ? userCredits : '...'}
              </span>
              <button
                onClick={handleLogout}
                className="text-xs px-3 py-1.5 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 transition-all"
              >
                登出
              </button>
            </div>
          ) : (
            <button
              onClick={handleGoogleLogin}
              className="text-xs px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium shadow transition-all flex items-center gap-1.5"
            >
              🔐 Google 快捷登录 (送 2 次免费体验)
            </button>
          )}
        </div>
      </div>

      <main className="flex flex-1 w-full max-w-3xl flex-col items-center gap-8 py-12 px-8 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl">
        <h1 className="text-3xl font-bold text-zinc-800 dark:text-white">
          吉他和弦
        </h1>

        {/* 上传区域 */}
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => {
            if (userCredits !== null && userCredits <= 0) {
              setShowPricingModal(true);
              return;
            }
            fileInputRef.current?.click();
          }}
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
              {isProcessing
                ? 'AI 正在全力处理中 (请勿关闭)...'
                : !user
                  ? '🔐 登录后开始 6 轨云端拆分 (送 2 次)'
                  : userCredits !== null && userCredits <= 0
                    ? '❌ 免费额度已用完（请点击充值）'
                    : `🚀 开始 6 轨云端拆分与和弦跟弹 (消耗 1 次, 剩余 ${userCredits})`}
            </button>
            {statusMsg && (
              <div className="text-center p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-mono font-medium text-blue-600 dark:text-blue-400">
                {statusMsg}
              </div>
            )}
          </div>
        )}

        {/* 🎛️ 多轨控制台 + 和弦跟弹区 */}
        {tracks.length > 0 && (
          <div className="w-full flex flex-col gap-6 border-t border-zinc-200 dark:border-zinc-800 pt-6">
            <div className="flex flex-col gap-3 bg-zinc-900 text-white p-5 rounded-2xl shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400 tracking-wider uppercase">
                  🎸 实时跟弹和弦 (Chord Sheet)
                </span>
                <span className="text-xs text-emerald-400 font-mono">
                  当前和弦: {chords[activeChordIdx]?.chord || '--'}
                </span>
              </div>

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

        {/* 📂 我的作品历史记录列表（支持展开分轨与和弦独立下载） */}
        {user && historyList.length > 0 && (
          <div className="w-full flex flex-col gap-3 border-t border-zinc-200 dark:border-zinc-800 pt-6">
            <h3 className="text-base font-bold text-zinc-800 dark:text-white flex items-center gap-2">
              📂 我的作品历史记录（含分轨与和弦下载）
            </h3>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {historyList.map((item) => {
                const isExpanded = expandedHistoryId === item.id;
                return (
                  <div
                    key={item.id}
                    className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700/50 overflow-hidden transition-all"
                  >
                    <div className="flex items-center justify-between p-3.5">
                      <div className="truncate mr-2">
                        <p className="font-semibold text-sm text-zinc-800 dark:text-zinc-200 truncate">
                          {item.file_name}
                        </p>
                        <span className="text-[11px] text-zinc-400 font-mono">
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                      </div>
                      <button
                        onClick={() => setExpandedHistoryId(isExpanded ? null : item.id)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-all shrink-0"
                      >
                        {isExpanded ? '收起详情 ▲' : '查看分轨与和弦 ▼'}
                      </button>
                    </div>

                    {/* 展开的下载面板 */}
                    {isExpanded && (
                      <div className="bg-zinc-100 dark:bg-zinc-900/80 p-4 border-t border-zinc-200 dark:border-zinc-700/50 flex flex-col gap-4">
                        {!item.task_id ? (
                          <p className="text-xs text-red-500">该条历史记录缺少 task_id 无法加载分轨文件（属于旧数据）</p>
                        ) : (
                          <>
                            <div>
                              <h4 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">
                                🎧 6 声道独立分轨下载
                              </h4>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {DEFAULT_TRACK_CONFIGS.map((trackConfig) => {
                                  const downloadUrl = getTrackDownloadUrl(item.task_id, trackConfig.file);
                                  return (
                                    <a
                                      key={trackConfig.id}
                                      href={downloadUrl}
                                      download={trackConfig.file}
                                      className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-blue-500 text-xs text-zinc-700 dark:text-zinc-200 transition-all"
                                    >
                                      <span className="truncate">{trackConfig.name.split(' ')[1]}</span>
                                      <span className="text-blue-500 font-bold ml-1">↓ 下载</span>
                                    </a>
                                  );
                                })}
                              </div>
                            </div>

                            <div>
                              <h4 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-wider">
                                🎸 吉他和弦识别数据
                              </h4>
                              <a
                                href={getChordDownloadUrl(item.task_id)}
                                download="chords.json"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow transition-all"
                              >
                                <span>📥 下载完整和弦数据 (chords.json)</span>
                              </a>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* 💰 次数耗尽付费引导弹窗 */}
      {showPricingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-96 max-w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 text-center relative animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">次数已用完</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6">
              剩余额度使用完毕。请选择套餐进行购买。
            </p>

            <div className="space-y-3 mb-6 text-left">
              <div
                onClick={() => handleCheckout('price_1UCdUGQz2VtPLHhxz4oWnvOb')}
                className="p-3 border rounded-xl border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 cursor-pointer flex justify-between items-center transition-all hover:scale-[1.02]"
              >
                <div>
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200">基础包 (50次)</div>
                  <div className="text-xs text-zinc-500">适合日常练习使用</div>
                </div>
                <span className="font-bold text-blue-600 text-lg">$4.99</span>
              </div>

              <div
                onClick={() => handleCheckout('price_1UCdUhQz2VtPLHhxntVIGB5i')}
                className="p-3 border rounded-xl border-zinc-200 dark:border-zinc-700 hover:border-blue-500 cursor-pointer flex justify-between items-center transition-all hover:scale-[1.02]"
              >
                <div>
                  <div className="font-semibold text-zinc-800 dark:text-zinc-200">畅享包 (200次)</div>
                  <div className="text-xs text-zinc-500">超高性价比，无限畅玩</div>
                </div>
                <span className="font-bold text-blue-600 text-lg">$12.99</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPricingModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => handleCheckout('price_1UCdUGQz2VtPLHhxz4oWnvOb')}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/30"
              >
                立即购买
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}