'use client';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  BUTTONS_PER_FLOOR,
  ELEVATOR_CAPACITY,
  ELEVATOR_COUNT,
  MAX_FLOOR,
  PERSON_GENERATION_INTERVAL,
  STOP_TIME_AT_FLOOR,
  TOTAL_PEOPLE,
  TRAVEL_TIME_PER_FLOOR
} from '@/constants/simulationConfig';

export default function Home() {
  const handleStartSimulation = () => {
    // TODO: Implement simulation start logic
    console.log('Simulation started!');
    // For now, let's add a dummy log entry
    const logArea = document.getElementById('log-area-content');
    if (logArea) {
      const newLogEntry = document.createElement('p');
      newLogEntry.textContent = `[${new Date().toLocaleTimeString()}] Simulation button clicked.`;
      logArea.appendChild(newLogEntry);
    }
  };

  return (
    <div className="container mx-auto p-4 flex flex-col items-center min-h-screen font-(family-name:--font-geist-sans)">
      <header className="w-full py-4 mb-8">
        <h1 className="text-3xl font-bold text-center">電梯管理系統儀表板</h1>
      </header>

      <div className="w-full max-w-2xl mb-8 p-6 bg-card border rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-3">模擬條件</h2>
        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
          <li>
            大樓共 {MAX_FLOOR} 層樓，{ELEVATOR_COUNT} 部電梯，每層電梯共用{' '}
            {BUTTONS_PER_FLOOR} 組按鈕
          </li>
          <li>電梯只可容納 {ELEVATOR_CAPACITY} 人</li>
          <li>每行經一層樓需耗時 {TRAVEL_TIME_PER_FLOOR} 秒</li>
          <li>每停一次處理接人放人需耗 {STOP_TIME_AT_FLOOR} 秒</li>
          <li>
            每 {PERSON_GENERATION_INTERVAL}
            秒產生1個人按電梯，設定出現樓層與目標的樓層，樓層隨機
          </li>
          <li>
            模擬放進 {TOTAL_PEOPLE} 人次，該設計需消耗掉所有人數，並統計秒數
          </li>
        </ul>
      </div>

      <main className="w-full max-w-2xl flex flex-col gap-6">
        <div className="flex justify-center">
          <Button onClick={handleStartSimulation} size="lg">
            開始模擬
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">執行日誌</h2>
          <ScrollArea className="h-96 w-full rounded-md border p-4 bg-muted/40">
            <div id="log-area-content" className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">
                點擊「開始模擬」按鈕以查看日誌...
              </p>
              {/* Log entries will be appended here */}
            </div>
          </ScrollArea>
        </div>
      </main>
      <footer className="w-full py-8 mt-12 text-center">
        <a
          href="https://github.com/john-data-chen/elevator-management-system"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          查看專案原始碼
        </a>
      </footer>
    </div>
  );
}
