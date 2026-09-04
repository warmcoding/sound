'use client';

import { useState, useRef, useCallback } from 'react';

export default function Home() {
  // 原有状态管理
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🆕 新增状态：用于处理 AI 分离过程
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  // 处理文件选择（无论是拖拽还是点击）
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('audio/')) {
      alert('请上传音频文件！');
      return;
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);

    setAudioFile(file);
    setAudioUrl(URL.createObjectURL(file));
    setStatusMsg(''); // 每次选新文件时清空提示
  }, [audioUrl]);

  // 拖拽相关事件处理
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

  // 🆕 核心：发送请求到 Next.js 中转站，并处理 ZIP 下载
  const handleStartSeparation = async () => {
    if (!audioFile) return;

    setIsProcessing(true);
    setStatusMsg('🎵 正在分离音轨，AI 努力工作中，请耐心等待...');

    const formData = new FormData();
    formData.append('file', audioFile);

    try {
      const response = await fetch('/api/process-audio', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '处理失败');
      }

      // 将返回的 ZIP 文件流转换为 Blob 并生成下载链接
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);

      // 自动触发浏览器下载
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${audioFile.name.split('.')[0]}_stems.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setStatusMsg('✅ 音轨分离成功！ZIP 文件已开始下载');
    } catch (error: any) {
      console.error(error);
      setStatusMsg(`❌ 请求出错: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black p-4">
      <main className="flex flex-1 w-full max-w-2xl flex-col items-center justify-center gap-8 py-16 px-8 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl">
        <h1 className="text-3xl font-bold text-zinc-800 dark:text-white">
          Sound Studio
        </h1>

        {/* 拖拽上传区域 */}
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`w-full h-48 flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer transition-all duration-300
            ${isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500'
            }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <p className="text-lg font-medium text-zinc-600 dark:text-zinc-300">
            {isDragging ? '松开鼠标上传' : '拖拽音频文件到这里，或点击选择'}
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            支持 MP3, WAV, OGG 等常见音频格式
          </p>
        </div>

        {/* 音频播放器 & 操作区 */}
        {audioUrl && (
          <div className="w-full flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate max-w-full">
              当前文件: {audioFile?.name}
            </p>
            <audio
              controls
              src={audioUrl}
              className="w-full h-14 rounded-lg"
            />

            {/* 🆕 开始分离按钮 */}
            <button
              onClick={handleStartSeparation}
              disabled={isProcessing}
              className={`w-full py-3 rounded-lg text-lg font-semibold transition-all mt-2
                ${isProcessing
                  ? 'bg-zinc-400 cursor-not-allowed text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg'
                }`}
            >
              {isProcessing ? 'AI 处理中...' : '🚀 开始分离音轨'}
            </button>

            {/* 🆕 状态提示 */}
            {statusMsg && (
              <div className="w-full text-center p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium">
                {statusMsg}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}