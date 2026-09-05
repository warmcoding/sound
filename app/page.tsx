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
  const [taskId, setTaskId] = useState<string | null>(null)
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
        setStatus(`[3/3] Modal GPU 正在拆分与分析和弦... (已等待 ${attempts * 3} 秒)`)

        const { data, error } = await supabase.storage
          .from('separated-tracks')
          .download(`results/${currentTaskId}/chords.json`)

        if (data && !error) {
          clearInterval(interval)
          const text = await data.text()
          resolve(JSON.parse(text))
        } else if (attempts >= maxAttempts) {
          clearInterval(interval)
          reject(new Error('处理超时，请前往 Modal 仪表盘检查日志'))
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
      setTaskId(currentTaskId)

      setStatus('[1/3] 正在上传原音频到 Supabase...')

      const { error: uploadError } = await supabase.storage
        .from('original-audio')
        .upload(`uploads/${filename}`, file, {
          contentType: file.type || 'audio/mpeg',
          upsert: true,
        })

      if (uploadError) throw new Error(`上传失败: ${uploadError.message}`)

      setStatus('[2/3] 音频上传成功，正在调起 Modal 云端 GPU 异步处理...')

      const res = await fetch(MODAL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      })

      if (!res.ok) throw new Error('调起 Modal 失败')

      // 异步触发后，开始轮询等待结果
      const chordData = await pollForResults(currentTaskId)

      setChords(chordData)

      // 组装 6 轨音频的公开下载/播放 URL
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
    <main className="min-h-screen p-8 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">🎸 吉他和弦分离与 6 轨播放工具</h1>

      <div className="p-6 border rounded-lg bg-slate-50 space-y-4">
        <input
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          disabled={loading}
          className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />

        <button
          onClick={handleProcess}
          disabled={!file || loading}
          className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg disabled:opacity-50 hover:bg-blue-700 font-medium"
        >
          {loading ? 'AI 处理中 (请勿关闭页面)...' : '开始上传并分离识别'}
        </button>

        {status && (
          <p className="text-sm font-mono text-slate-600 mt-2">{status}</p>
        )}
      </div>

      {/* 6 轨分离音频播放器 */}
      {Object.keys(tracks).length > 0 && (
        <div className="p-6 border rounded-lg bg-white space-y-4">
          <h2 className="text-lg font-bold">🎵 6 轨分离音轨</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(tracks).map(([trackName, url]) => (
              <div key={trackName} className="p-3 border rounded bg-slate-50 space-y-2">
                <span className="font-semibold capitalize text-sm text-slate-700">{trackName}</span>
                <audio controls src={url} className="w-full h-10" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 和弦识别结果展示 */}
      {chords && chords.length > 0 && (
        <div className="p-6 border rounded-lg bg-white space-y-4">
          <h2 className="text-lg font-bold">🎸 识别结果 (共 {chords.length} 段和弦):</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-sm max-h-60 overflow-y-auto">
            {chords.map((item, index) => (
              <div key={index} className="p-2 border rounded bg-slate-50 text-center">
                <span className="text-gray-500">{item.time}s: </span>
                <span className="font-bold text-blue-600">{item.chord}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}