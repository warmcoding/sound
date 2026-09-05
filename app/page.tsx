'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = "https://teuhgretiiawyjtkuzkh.supabase.co"
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRldWhncmV0aWlhd3lqdGt1emtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MzE1OTUsImV4cCI6MjEwNDAwNzU5NX0.ElBYECVaWA0SLLWgSHgI7zaDFNdrG15DEkZ2U3RU7iA"
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const MODAL_ENDPOINT = "https://warmcoding--guitar-chord-separator-trigger-process.modal.run"

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [chords, setChords] = useState<Array<{ time: number; chord: string }> | null>(null)
  const [tracks, setTracks] = useState<Record<string, string>>({})

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  // 轮询检查结果
  const pollForResults = (currentTaskId: string) => {
    return new Promise<any[]>((resolve, reject) => {
      let attempts = 0
      const maxAttempts = 120 // 最多等待 6 分钟

      const interval = setInterval(async () => {
        attempts++
        setStatus(`[3/3] 音轨拆分与和弦识别中... (已等待 ${attempts * 3} 秒)`)

        const { data, error } = await supabase.storage
          .from('separated-tracks')
          .download(`results/${currentTaskId}/chords.json`)

        if (data && !error) {
          clearInterval(interval)
          const text = await data.text()
          resolve(JSON.parse(text))
        } else if (attempts >= maxAttempts) {
          clearInterval(interval)
          reject(new Error('处理超时，请稍后重试'))
        }
      }, 3000)
    })
  }

  const handleProcess = async () => {
    if (!file) {
      alert('请先选择一个 MP3 音频文件')
      return
    }

    try {
      setLoading(true)
      setChords(null)
      setTracks({})

      const timestamp = Date.now()
      const randomStr = Math.random().toString(36).substring(2, 7)
      const filename = `${timestamp}_${randomStr}.mp3`
      const currentTaskId = `${timestamp}_${randomStr}`

      setStatus('[1/3] 正在上传原音频到 Supabase...')

      const { error: uploadError } = await supabase.storage
        .from('original-audio')
        .upload(`uploads/${filename}`, file, {
          contentType: file.type || 'audio/mpeg',
          upsert: true,
        })

      if (uploadError) throw new Error(`上传失败: ${uploadError.message}`)

      setStatus('[2/3] 上传成功，正在调起 Modal 云端 GPU 异步处理...')

      const res = await fetch(MODAL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      })

      if (!res.ok) throw new Error('调起 Modal 失败')

      // 异步触发后，开始轮询等待结果
      const chordData = await pollForResults(currentTaskId)
      setChords(chordData)

      // 组装 6 轨音频的公开 URL
      const trackNames = ['vocals', 'guitar', 'bass', 'drums', 'piano', 'other']
      const trackUrls: Record<string, string> = {}

      for (const track of trackNames) {
        const { data } = supabase.storage
          .from('separated-tracks')
          .getPublicUrl(`results/${currentTaskId}/${track}.wav`)
        if (data?.publicUrl) {
          trackUrls[track] = data.publicUrl
        }
      }
      setTracks(trackUrls)

      setStatus('🎉 音轨拆分与和弦识别完成！')
    } catch (err: any) {
      console.error(err)
      setStatus(`❌ 发生错误: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">

        {/* 标题区 */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            🎸 吉他和弦分离与 6 轨播放工具
          </h1>
          <p className="text-slate-400 text-sm">基于 Modal 云端 GPU 算力与 Demucs AI 模型打造</p>
        </div>

        {/* 上传控制面板 */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <label className="w-full sm:w-auto cursor-pointer px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2">
              <span>选择文件</span>
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                disabled={loading}
                className="hidden"
              />
            </label>
            <span className="text-sm text-slate-400 truncate max-w-xs">
              {file ? file.name : '未选择任何音频文件'}
            </span>
          </div>

          <button
            onClick={handleProcess}
            disabled={!file || loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:hover:bg-blue-600 text-white font-semibold rounded-xl shadow-lg transition duration-200"
          >
            {loading ? 'AI 正在全力处理中...' : '开始上传并分离识别'}
          </button>

          {status && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-blue-400">
              {status}
            </div>
          )}
        </div>

        {/* 6 音轨独立播放器面板 */}
        {Object.keys(tracks).length > 0 && (
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
              <span>🎵</span> 6 轨分离音轨
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(tracks).map(([trackName, url]) => (
                <div key={trackName} className="p-4 bg-slate-950 border border-slate-800/80 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold capitalize text-sm text-blue-300">{trackName}</span>
                    <a
                      href={url}
                      download={`${trackName}.wav`}
                      className="text-xs text-slate-400 hover:text-white underline"
                    >
                      下载
                    </a>
                  </div>
                  <audio controls src={url} className="w-full h-9 accent-blue-500" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 和弦识别结果展示面板 */}
        {chords && chords.length > 0 && (
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-slate-200 flex items-center gap-2">
              <span>🎸</span> 吉他和弦时间轴 (共 {chords.length} 段)
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 font-mono text-sm max-h-72 overflow-y-auto pr-1">
              {chords.map((item, index) => (
                <div key={index} className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-center flex flex-col justify-center">
                  <span className="text-xs text-slate-500">{item.time}s</span>
                  <span className="text-base font-bold text-blue-400 mt-0.5">{item.chord}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </main>
  )
}