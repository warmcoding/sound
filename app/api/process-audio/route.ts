// app/api/process-audio/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        // 1. 接收前端传来的 FormData
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: '未检测到文件' }, { status: 400 });
        }

        console.log(`[Next.js] 收到文件: ${file.name}, 准备转发给 Python...`);

        // 2. 转发给真实的 Python 后端 (注意路径改成了 /separate-audio/)
        const pythonResponse = await fetch('http://localhost:8000/separate-audio/', {
            method: 'POST',
            body: formData,
        });

        // 3. 检查 Python 是否报错
        if (!pythonResponse.ok) {
            const errorText = await pythonResponse.text();
            throw new Error(`Python 后端报错: ${errorText}`);
        }

        // 4. 【核心】因为 Python 返回的是 ZIP 文件流，我们需要把它作为 Blob 接收
        const blob = await pythonResponse.blob();

        console.log('[Next.js] Python 处理完成，ZIP 文件已生成，返回给前端');

        // 5. 把文件流返回给前端，并带上正确的 Header
        return new NextResponse(blob, {
            status: 200,
            headers: {
                'Content-Disposition': `attachment; filename="${file.name.split('.')[0]}_stems.zip"`,
                'Content-Type': 'application/zip',
            },
        });

    } catch (error) {
        console.error('[Next.js] 中转出错:', error);
        return NextResponse.json(
            { error: '服务器内部错误，请检查 Python 服务是否启动' },
            { status: 500 }
        );
    }
}