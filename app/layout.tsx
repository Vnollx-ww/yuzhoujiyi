// src/app/layout.tsx

import './globals.css'
// ⚠️ 注意：这里故意删除了 Next.js 默认的字体导入代码，以修复构建错误。

export const metadata = {
  title: 'Memory Galaxy | 星际浮雕画廊',
  description: 'AI Powered 3D Memory Storage',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh">
      {/* <body> 标签里不再有任何 class，保证全屏黑色的纯净度 */}
      <body> 
        {children}
      </body>
    </html>
  )
}