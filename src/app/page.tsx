'use client';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  BUTTONS_PER_FLOOR,
  ELEVATOR_CAPACITY,
  ELEVATOR_TOTAL,
  MAX_FLOOR,
  PERSON_GENERATION_INTERVAL,
  STOP_TIME_AT_FLOOR,
  TOTAL_PEOPLE,
  TRAVEL_TIME_PER_FLOOR
} from '@/constants/simulationConfig';
import { runFullSimulation } from '@/lib/simulation';
import type { SimulationLogEntry } from '@/types/simulation.types';
import { useState } from 'react';

export default function Home() {
  const [simulationLogs, setSimulationLogs] = useState<SimulationLogEntry[]>(
    []
  );
  const [totalSimulationTime, setTotalSimulationTime] = useState<number | null>(
    null
  );

  const handleStartSimulation = () => {
    console.log('Simulation started!');
    // 清空之前的日誌和時間
    setSimulationLogs([]);
    setTotalSimulationTime(null);

    // 執行模擬
    const results = runFullSimulation();

    // 更新狀態
    setSimulationLogs(results.logs);
    setTotalSimulationTime(results.totalTime);

    console.log('Simulation finished!', results);
  };

  return (
    <div className="font-(family-name:--font-geist-sans) container mx-auto flex min-h-screen flex-col items-center p-4">
      <header className="mb-8 w-full py-4">
        <h1 className="text-center font-bold text-3xl">電梯管理系統儀表板</h1>
      </header>

      <div className="mb-8 w-full max-w-2xl rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="mb-3 font-semibold text-xl">模擬條件</h2>
        <ul className="list-inside list-disc space-y-1 text-muted-foreground text-sm">
          <li>
            大樓共 {MAX_FLOOR} 層樓，{ELEVATOR_TOTAL} 部電梯，每層電梯共用{' '}
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

      <main className="flex w-full max-w-2xl flex-col gap-6">
        <div className="flex justify-center">
          <Button onClick={handleStartSimulation} size="lg">
            開始模擬
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold text-xl">執行日誌</h2>
          {totalSimulationTime !== null && (
            <p className="text-muted-foreground text-sm">
              總模擬時間: {totalSimulationTime} 秒
            </p>
          )}
          <ScrollArea className="h-96 w-full rounded-md border bg-muted/40 p-4">
            <div id="log-area-content" className="flex flex-col gap-1">
              {simulationLogs.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  點擊「開始模擬」按鈕以查看日誌...
                </p>
              ) : (
                simulationLogs.map((log, index) => (
                  <p key={log.time} className="text-muted-foreground text-sm">
                    [{log.time}] {log.message}
                  </p>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </main>
      <footer className="mt-12 w-full py-8 text-center">
        <a
          href="https://github.com/john-data-chen/elevator-management-system"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground text-sm transition-colors hover:text-primary"
        >
          查看專案原始碼
        </a>
      </footer>
    </div>
  );
}
