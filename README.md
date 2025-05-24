# 電梯管理系統

這是一個儀表板，模擬並顯示電梯管理系統運作狀態。

## 模擬條件

- 大樓共 10 層樓，2 部電梯，每層電梯共用 1 組按鈕
- 電梯只可容納 5 人
- 每行經一層樓需耗時 1 秒
- 每停一次處理接人放人需耗 1 秒
- 每秒產生 1 個人按電梯，設定出現樓層與目標樓層，樓層隨機
- 模擬放進 40 人次，該設計需消耗掉所有人數，並統計秒數

## 使用技術

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

## simulation.ts 電梯管理系統 — 雙電梯模擬演算法設計說明

### 主要物件

- **Elevator（電梯）**
  - id: 電梯編號
  - currentFloor: 當前樓層
  - passengers: 乘客清單
  - status: 狀態（idle, movingUp, movingDown, doorsOpen, stopped）
  - targetFloors: 目標樓層集合
  - capacity: 容量
  - currentDirection: 當前方向（up, down, idle）
  - doorOpenTime: 開門倒數

- **Person（乘客）**
  - id: 乘客編號
  - spawnTime: 產生時間
  - sourceFloor: 起點樓層
  - destinationFloor: 目的樓層
  - status: 狀態（waiting, inElevator, completed）
  - assignedElevatorId: 分配到的電梯
  - pickupTime: 上車時間
  - dropOffTime: 下車時間

- **SimulationState（模擬狀態）**
  - currentTime: 當前模擬時間
  - elevators: 電梯陣列
  - people: 乘客陣列
  - floorCalls: 樓層呼叫清單
  - logs: 日誌
  - totalPeopleToSimulate: 總人數
  - peopleGenerated: 已產生人數
  - peopleCompleted: 已完成人數

### 主要函式

- `initializeElevators()`: 初始化電梯陣列
- `randomFloor(exclude?)`: 隨機產生樓層
- `assignElevator(state, call)`: 分配最適合的電梯給呼叫（採用 SCAN 策略）
- `moveElevator(state, elevator)`: 控制電梯移動與狀態切換
- `shouldStopAtCurrentFloor(state, elevator)`: 判斷是否需在當前樓層停靠
- `getNextTarget(elevator)`: 取得下一個目標樓層（SCAN 策略）
- `processElevatorStop(state, elevator)`: 處理電梯停靠、上下乘客
- `runFullSimulation()`: 主模擬流程

---

### 運作流程

1. **初始化**
   - 建立兩部電梯，設定初始狀態。
   - 設定模擬參數（樓層數、容量、產生人數等）。

2. **每秒模擬循環**
   - 產生新乘客（隨機起點與終點）。
   - 產生樓層呼叫，將乘客分配給最適合的電梯。
   - 每部電梯依據目標與方向進行移動（SCAN 演算法），遇到需停靠時開門上下乘客。
   - 更新乘客與電梯狀態，記錄日誌。
   - 持續直到所有乘客完成或達到最大模擬週期。

3. **結束與統計**
   - 統計總耗時、完成乘客數、未完成乘客資訊。

---

### 設計概念與功能說明

#### 電梯調度策略（SCAN/Elevator Algorithm）

- **SCAN（電梯演算法）**：
  電梯會在一個方向上持續服務所有請求，直到沒有請求，再反向。這可減少等待時間與避免飄忽不定的移動。
- **多台電梯協作**：
  每台電梯根據目前方向、目標與負載自動分配新請求，避免所有請求都集中在同一台電梯。
- **容量考量**：
  分配時只考慮有空位的電梯，若都滿載則暫緩分配，避免無窮等待。

### 物件與函式功能

- **Elevator/Person/SimulationState**：
  以物件導向方式封裝狀態，便於管理與擴充。
- **assignElevator**：
  根據方向、距離、負載等因素選擇最佳電梯，並將呼叫加入目標樓層。
- **moveElevator/shouldStopAtCurrentFloor/processElevatorStop**：
  控制電梯移動、停靠、上下乘客，並自動調整方向與目標。
- **runFullSimulation**：
  負責整體模擬流程與統計，並輸出日誌供前端顯示。

---

### 優化與真實模擬策略

- **方向優先**：
  電梯只接同方向且在路徑上的呼叫，減少無謂移動。
- **負載均衡**：
  新呼叫優先分配給較空閒或較近的電梯，避免單一電梯過載。
- **避免無窮等待**：
  當所有電梯滿載時，呼叫暫緩分配，等有空位再分配，確保所有乘客最終都能完成。
- **日誌與異常偵測**：
  模擬過程中記錄詳細日誌，若有乘客長時間未完成則警告，方便除錯與優化。

---

### 未來改進事項

- 目前在 2000秒(33.3分鐘) 內完成 40 人的成功率約 30%。增加模擬週期無助於提高成功率。
- 未來想使用如 LOOK 或 C-SCAN 算法，可能會提高成功率。
- 目前模擬參數皆固定，未來想增加更多的隨機性，以貼近現實情況。
