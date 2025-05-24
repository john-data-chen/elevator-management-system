# 電梯管理系統

這是一個儀表板，模擬跟顯示電梯管理系統運作狀態。

## 模擬條件

- 大樓共10層樓，2部電梯，每層電梯共用1組按鈕
- 電梯只可容納5人
- 每行經一層樓需耗時1秒
- 每停一次處理接人放人需耗1秒
- 每秒產生1個人按電梯，設定出現樓層與目標的樓層，樓層隨機
- 模擬放進40人次，該設計需消耗掉所有人數，並統計秒數

## 使用技術

本專案使用

### Frontend

 - TypeScript
 - React 19.x
 - Next.js 15.x (App Router)
 - Tailwindcss 4.x
 - Shadcn UI

### Code Quality

 - Biome
 - Lefthook

### Deployment

- Vercel: [Demo Site](https://elevator-management-system.vercel.app/)

## 專案架構

```text
src/
├── app/ # Next.js App routes
│   ├── page.tsx # Root page (儀表板)
│   ├── layout.tsx # Layout component
│   ├── global.css # Global styles (by tailwindcss)
├── components/ui/ # Shared UI components
├── constants/ # 模擬參數
├── lib/
│   ├── simulation.ts # 模擬主程式
│   └── utils.ts # tailwindcss utils
└── types/ # Type definitions
```

## simulation.ts

模擬主程式，模擬電梯管理系統運作狀態，輸出 log 至 Root page 儀表板。
