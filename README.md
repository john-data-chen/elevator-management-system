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
  - pickupTime: 進入時間
  - dropOffTime: 離開時間

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

#### 初始化

   - 建立兩部電梯，設定初始狀態。
   - 設定模擬參數（樓層數、容量、產生人數等）。

#### 每秒模擬循環

   - 產生新乘客（隨機起點與終點）。
   - 產生樓層呼叫，將乘客分配給最適合的電梯。
   - 每部電梯依據目標與方向進行移動（SCAN 演算法），遇到需停靠時開門上下乘客。
   - 更新乘客與電梯狀態，記錄日誌。
   - 持續直到所有乘客完成或達到最大模擬週期。

#### 結束與統計

   - 統計總耗時、完成乘客數、未完成乘客資訊。

---

### 設計概念與功能說明

本模擬採用了類似 **LOOK 演算法** 的電梯調度策略，並針對多電梯協作進行了優化。核心概念如下：

#### 方向性服務 (Directional Service)：

- 電梯會優先服務與其當前運行方向一致的請求。
- 例如，一部向上運行的電梯會優先停靠在其路徑上所有向上的呼叫樓層和乘客指定向上樓層。

#### 動態目標調整 (Dynamic Target Adjustment - LOOK 變體)：

- 電梯不會盲目地運行到最高或最低樓層 (傳統 SCAN)。
- 而是根據當前方向上最遠的請求（乘客目的地或樓層呼叫）來決定轉向點。
- 一旦在當前方向上沒有更多請求，電梯就會改變方向，服務反向的請求。
- `getNextTarget` 函數負責實現此邏輯，收集所有乘客目的地和已分配的樓層呼叫，並根據電梯當前方向和位置決定下一個最優停靠點。

#### 多電梯協作與負載均衡 (Multi-Elevator Coordination & Load Balancing)：

`assignElevator` 函數負責將新的樓層呼叫分配給最合適的電梯。

##### 分配標準綜合考慮以下因素：

- 距離：優先選擇距離呼叫樓層較近的電梯。
- 方向匹配：優先選擇與呼叫方向一致且呼叫樓層在其行進路徑上的電梯。
- 閒置狀態：閒置電梯會被優先考慮。
- 即將轉向：如果電梯在當前方向上已無目標，即使目前方向與呼叫相反，也可能被選中（因為它即將轉向）。
- 負載：電梯內乘客數量會影響評分，避免單一電梯過載。
- 目標數量：電梯已有的目標樓層數量也會納入考量，傾向於讓電梯完成現有任務。
- 如果電梯在停靠時已滿，無法接納更多等待的乘客，系統會嘗試將這些乘客重新分配給其他有容量的電梯。

##### 停靠邏輯 (`shouldStopAtCurrentFloor` 和 `processElevatorStop`)：

電梯會在以下情況停靠：

- 有乘客要在此樓層下車。
- 有已分配給此電梯的乘客在此樓層等待上車，且電梯方向匹配或即將轉向。
- 當前樓層是電梯的目標樓層之一（來自外部呼叫）。
- 停靠時，先處理下車乘客，再處理上車乘客（如果容量允許）。

#### 核心優勢

- 效率提升：相較於簡單的先來先服務，LOOK/SCAN 策略能更有效地組織電梯路徑，減少空跑和乘客平均等待時間。
- 系統吞吐量：通過多電梯協作和負載均衡，提高了系統整體處理乘客請求的能力。
- 避免飢餓：雖然沒有嚴格的C-SCAN，但是 LOOK 策略配合合理的分配體系，可以幫助避免要求很長時間才能得到服務。

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
  模擬過程中記錄詳細日誌，若有乘客未完成則警告，並記錄模擬統計，方便除錯與優化。

---

### 未來改進事項

目前以固定參數在 2000秒(33.3分鐘) 內完成 40 人的成功率約 50~60%。增加模擬週期無助於提高成功率。

- 實驗更多跟不同策略組合，提升成功率。
- 目前模擬參數皆固定，未來想增加更多的隨機性，以貼近現實情況。
