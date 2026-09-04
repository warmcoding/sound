'use client';

import { useState, useRef, useCallback } from 'react';

export default function Home() {
  // 状态管理
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理文件选择（无论是拖拽还是点击）
  const handleFile = useCallback((file: File) => {
    // 简单的文件类型校验
    if (!file.type.startsWith('audio/')) {
      alert('请上传音频文件！');
      return;
    }
    // 如果之前有旧文件，释放内存
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioFile(file);
    setAudioUrl(URL.createObjectURL(file));
  }, [audioUrl]);

  // 拖拽相关事件处理
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  // 点击选择文件
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
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

        {/* 音频播放器 */}
        {audioUrl && (
          <div className="w-full flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
            <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate max-w-full">
              当前文件 file : {audioFile?.name}
            </p>
            <audio
              controls
              src={audioUrl}
              className="w-full h-14 rounded-lg"
            />
          </div>
        )}
      </main>
    </div>
  );
}