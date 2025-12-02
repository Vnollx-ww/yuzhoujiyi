// src/app/api/chat/route.ts

import { NextResponse } from 'next/server';
import OpenAI from "openai";
import fs from 'fs';
import path from 'path';

// 打印 Key 状态 (用于启动时调试)
const apiKey = process.env.DOUBAO_API_KEY || '';
const endpoint = process.env.DOUBAO_ENDPOINT_ID || '';
console.log('🔑 API Key 状态:', apiKey ? `已读取 (开头: ${apiKey.substring(0, 5)}...)` : '❌ 未读取到！请检查 .env.local');
console.log('🔌 接入点 ID:', endpoint ? `已读取 (${endpoint})` : '❌ 未读取到！');

const client = new OpenAI({
  apiKey: process.env.DOUBAO_API_KEY,
  baseURL: "https://ark.cn-beijing.volces.com/api/v3",
});

export async function POST(req: Request) {
  try {
    const { text, photoUrl, history } = await req.json(); // <-- 接收完整的历史记录
    console.log(`📨 收到前端请求... (共 ${history.length + 1} 条记录)`);

    // 1. 找图片并转 Base64
    const safeUrl = photoUrl.startsWith('/') ? photoUrl.slice(1) : photoUrl;
    const imagePath = path.join(process.cwd(), 'public', safeUrl);
    
    if (!fs.existsSync(imagePath)) {
      return NextResponse.json({ reply: "系统错误：找不到记忆碎片文件。" });
    }
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

    // 2. 构建完整的消息队列
    const messages = [
        {
            // 系统身份设定，放在最前面
            role: "system",
            content: "你是一个富有诗意和情感的'记忆星际档案员'。请你保持对话的连贯性，并根据照片内容和用户的话进行回复。请保持回复简短、有趣。"
        }
    ];

    // 3. 注入历史记录
    // 过滤掉前端 UI 用的“系统指令”，只注入真正的对话内容
    history.forEach(msg => {
        if (!msg.content.includes("系统指令：")) {
            messages.push({ role: msg.role, content: msg.content });
        }
    });

    // 4. 注入当前用户输入 (包含图片)
    messages.push({
        role: "user",
        content: [
            { type: "text", text: text || "请根据画面内容向我提问。" },
            {
                type: "image_url",
                image_url: { url: base64Image },
            },
        ],
    });


    // 5. 呼叫豆包
    const completion = await client.chat.completions.create({
      messages: messages as any, // 传入完整历史
      model: process.env.DOUBAO_ENDPOINT_ID as string,
      max_tokens: 500,
    });

    const reply = completion.choices[0].message.content;
    console.log('🤖 豆包成功回复:', reply);

    return NextResponse.json({ reply });

  } catch (error) {
    console.error('💥 发生爆炸错误:', error);
    return NextResponse.json({ reply: `系统故障：记忆提取失败。请检查 Key 或 Endpoint ID 是否正确。` });
  }
}