// app/api/process-audio/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 初始化 Supabase 服务端客户端（建议在环境变量中配置好）
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
    try {
        // 1. 接收前端传来的 FormData
        const formData = await request.formData();
        const file = formData.get('file') as File;
        const userEmail = formData.get('user_email') as string; // 接收前端传过来的用户邮箱

        if (!file) {
            return NextResponse.json({ error: '未检测到文件' }, { status: 400 });
        }

        console.log(`[Next.js] 收到文件: ${file.name}, 用户: ${userEmail || '未知'}, 准备转发给 Python...`);

        // 2. 转发给真实的 Python 后端
        const pythonResponse = await fetch('http://localhost:8000/separate-audio/', {
            method: 'POST',
            body: formData,
        });

        // 3. 检查 Python 是否报错
        if (!pythonResponse.ok) {
            const errorText = await pythonResponse.text();
            throw new Error(`Python 后端报错: ${errorText}`);
        }

        // 4. 获取处理后的 ZIP 文件 Blob
        const blob = await pythonResponse.blob();

        console.log('[Next.js] Python 处理完成，ZIP 文件已生成');

        // 5. 【新增】如果用户邮箱存在，将历史记录写入 Supabase
        if (userEmail) {
            const fileNameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            const outputFilename = `${fileNameWithoutExt}_stems.zip`;

            // 如果你把文件上传到了 Supabase Storage，可以在这里获取公开访问 URL；
            // 如果暂时没有做云端存储，可以先存入文件名和成功状态
            const { error: dbError } = await supabase.from('user_history').insert([
                {
                    user_email: userEmail,
                    file_name: file.name,
                    result_url: '#', // 后续如果你将结果存入 Supabase Storage，可以把真实的存储 URL 填在这里
                    status: 'success'
                }
            ]);

            if (dbError) {
                console.error('[Next.js] 写入历史记录失败:', dbError.message);
            }
        }

        // 6. 把文件流返回给前端
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