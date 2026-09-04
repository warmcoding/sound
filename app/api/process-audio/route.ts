// app/api/process-audio/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        // 1. 接收前端传来的 FormData（包含音频文件）
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: '未检测到文件' }, { status: 400 });
        }

        console.log(`[Next.js] 收到文件: ${file.name}, 准备转发给 Python...`);

        // ==========================================
        // ⬇️ 这里是修改的核心部分 ⬇️
        // ==========================================

        // 2. 将文件转发给真实的 Python 后端
        // 假设你的 Python 后端运行在 http://localhost:8000/process
        // 注意：这里使用的是 Node.js 环境下的 fetch，不是浏览器的 fetch
        const pythonResponse = await fetch('http://localhost:8000/process', {
            method: 'POST',
            body: formData,
            // ⚠️ 关键点：不要手动设置 Content-Type，让 Node.js 自动处理 boundary
        });

        // 3. 检查 Python 后端是否处理成功
        if (!pythonResponse.ok) {
            throw new Error(`Python 后端报错: ${pythonResponse.statusText}`);
        }

        // 4. 获取 Python 返回的 JSON 数据
        const result = await pythonResponse.json();

        // ==========================================
        // ⬆️ 修改结束 ⬆️
        // ==========================================

        console.log('[Next.js] Python 处理完成，返回结果给前端');

        // 5. 把结果返回给前端
        return NextResponse.json(result);

    } catch (error) {
        console.error('[Next.js] 中转出错:', error);
        return NextResponse.json(
            { error: '服务器内部错误，请检查 Python 服务是否启动' },
            { status: 500 }
        );
    }
}