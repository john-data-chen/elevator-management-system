'use client';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import React from 'react'; // Import React for useState and useEffect if needed later

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
      <footer className="w-full py-4 mt-auto">
        <p className="text-center text-sm text-muted-foreground">
          電梯模擬系統 MVP
        </p>
      </footer>
    </div>
  );
}
