import {
  ELEVATOR_CAPACITY,
  ELEVATOR_TOTAL,
  ESTIMATED_PROCESSING_TIME,
  MAX_FLOOR,
  MIN_FLOOR,
  PERSON_GENERATION_INTERVAL,
  STOP_TIME_AT_FLOOR,
  TOTAL_PEOPLE
} from '@/constants/simulationConfig';
import type { FloorCall } from '@/types/call.types';
import type { Elevator, ElevatorId } from '@/types/elevator.types';
import type { FloorNumber } from '@/types/floor.types';
import type { Person } from '@/types/person.types';
import type {
  SimulationLogEntry,
  SimulationState
} from '@/types/simulation.types';

function log(state: SimulationState, entry: Omit<SimulationLogEntry, 'time'>) {
  state.logs.push({ ...entry, time: state.currentTime });
}

function randomFloor(exclude?: number): number {
  let floor = 0;
  do {
    floor = Math.floor(Math.random() * (MAX_FLOOR - MIN_FLOOR + 1)) + MIN_FLOOR;
  } while (floor === exclude);
  return floor;
}

function initializeElevators(): Elevator[] {
  return Array.from({ length: ELEVATOR_TOTAL }, (_, i) => ({
    id: `elevator-${i + 1}` as ElevatorId,
    currentFloor: 1,
    passengers: [],
    status: 'idle',
    targetFloors: new Set(),
    capacity: ELEVATOR_CAPACITY,
    currentDirection: 'idle',
    doorOpenTime: 0
  }));
}

function assignElevator(
  state: SimulationState,
  call: FloorCall
): ElevatorId | undefined {
  let bestElevator: Elevator | null = null;
  let minScore = Number.MAX_SAFE_INTEGER;

  for (const elevator of state.elevators) {
    if (elevator.passengers.length >= elevator.capacity) continue; // 電梯已滿

    let score = 0;
    const distance = Math.abs(elevator.currentFloor - call.floor);

    // 情況1: 電梯閒置
    if (elevator.status === 'idle') {
      score = distance; // 距離越近越好
    }
    // 情況2: 電梯與呼叫同方向，且呼叫樓層在電梯路徑上
    else if (elevator.currentDirection === call.direction) {
      if (call.direction === 'up' && call.floor >= elevator.currentFloor) {
        score = distance; // 在前方，距離越近越好
      } else if (
        call.direction === 'down' &&
        call.floor <= elevator.currentFloor
      ) {
        score = distance; // 在前方，距離越近越好
      } else {
        score = distance + MAX_FLOOR; // 在後方，增加懲罰值
      }
    }
    // 情況3: 電梯與呼叫反方向，但電梯目標少或距離近，可考慮
    else {
      // 懲罰值，反向的電梯優先級較低
      // 考慮目標樓層數量，目標少的電梯更傾向於接受新請求
      score = distance + MAX_FLOOR * 2 + elevator.targetFloors.size;
    }

    // 考慮電梯負載，乘客越少越好
    score += elevator.passengers.length * 2; // 每多一個乘客，分數增加

    if (score < minScore) {
      minScore = score;
      bestElevator = elevator;
    }
  }

  if (bestElevator) {
    bestElevator.targetFloors.add(call.floor);
    // 如果電梯是閒置的，設定其方向以響應呼叫
    if (bestElevator.status === 'idle') {
      if (call.floor > bestElevator.currentFloor) {
        bestElevator.currentDirection = 'up';
        bestElevator.status = 'movingUp';
      } else if (call.floor < bestElevator.currentFloor) {
        bestElevator.currentDirection = 'down';
        bestElevator.status = 'movingDown';
      } else {
        // 如果剛好在同一層樓，則直接開門
        bestElevator.status = 'stopped';
        bestElevator.doorOpenTime = STOP_TIME_AT_FLOOR;
      }
    }
    return bestElevator.id;
  }

  return undefined; // 沒有合適的電梯
}

function moveElevator(state: SimulationState, elevator: Elevator) {
  // 加入 state 參數
  if (elevator.doorOpenTime && elevator.doorOpenTime > 0) {
    // 檢查門是否開啟
    elevator.doorOpenTime--;
    if (elevator.doorOpenTime === 0) {
      // 門關閉後，重新評估方向和狀態
      if (elevator.targetFloors.size > 0) {
        // 根據下一個目標決定方向
        const nextTarget = getNextTarget(elevator);
        if (nextTarget !== null) {
          if (nextTarget > elevator.currentFloor) {
            elevator.currentDirection = 'up';
            elevator.status = 'movingUp';
          } else if (nextTarget < elevator.currentFloor) {
            elevator.currentDirection = 'down';
            elevator.status = 'movingDown';
          } else {
            // 如果下一個目標是當前樓層（例如，剛接完人，內部又有同層請求），則再次停靠
            // 這個情況理論上 processElevatorStop 會處理，但以防萬一
            processElevatorStop(state, elevator);
            return;
          }
        } else {
          elevator.status = 'idle';
          elevator.currentDirection = 'idle';
        }
      } else {
        elevator.status = 'idle';
        elevator.currentDirection = 'idle';
      }
    }
    return; // 門還在倒數，不做其他事
  }

  // 檢查是否需要在當前樓層停靠 (接人或送人)
  if (shouldStopAtCurrentFloor(state, elevator)) {
    processElevatorStop(state, elevator);
    return;
  }

  // 如果沒有目標，則閒置
  if (elevator.targetFloors.size === 0 && elevator.passengers.length === 0) {
    elevator.status = 'idle';
    elevator.currentDirection = 'idle';
    return;
  }

  // 決定下一個移動方向和目標
  const nextTarget = getNextTarget(elevator);

  if (nextTarget === null) {
    // 沒有有效目標（例如，所有目標都已過，或乘客都已下車但仍有外部呼叫未處理完）
    // 嘗試尋找任何剩餘的 targetFloors (可能是反向的)
    if (elevator.targetFloors.size > 0) {
      const anyTarget = Array.from(elevator.targetFloors)[0]; // 取一個任意目標
      if (anyTarget > elevator.currentFloor) {
        elevator.currentDirection = 'up';
        elevator.status = 'movingUp';
      } else if (anyTarget < elevator.currentFloor) {
        elevator.currentDirection = 'down';
        elevator.status = 'movingDown';
      } else {
        // 如果目標是當前樓層，則停靠
        processElevatorStop(state, elevator);
        return;
      }
    } else {
      elevator.status = 'idle';
      elevator.currentDirection = 'idle';
      return;
    }
  } else {
    // 朝向下一個目標移動
    if (nextTarget > elevator.currentFloor) {
      elevator.currentDirection = 'up';
      elevator.status = 'movingUp';
    } else if (nextTarget < elevator.currentFloor) {
      elevator.currentDirection = 'down';
      elevator.status = 'movingDown';
    } else {
      // 理論上不應該到這裡，因為 shouldStopAtCurrentFloor 會先處理
      processElevatorStop(state, elevator);
      return;
    }
  }

  // 移動電梯
  if (elevator.status === 'movingUp') {
    elevator.currentFloor++;
  } else if (elevator.status === 'movingDown') {
    elevator.currentFloor--;
  }
  // 記錄移動日誌
  log(state, {
    message: `電梯 ${elevator.id} 移動至 ${elevator.currentFloor} 樓，方向: ${elevator.currentDirection === 'down' ? '向下' : elevator.currentDirection === 'up' ? '向上' : 'idle'}`,
    elevatorId: elevator.id,
    floor: elevator.currentFloor,
    details: {
      passengers: elevator.passengers.length,
      targets: Array.from(elevator.targetFloors).join(',')
    }
  });
}

// 新增輔助函數：判斷是否需要在當前樓層停靠
function shouldStopAtCurrentFloor(
  state: SimulationState,
  elevator: Elevator
): boolean {
  // 1. 是否有乘客要在此樓層下車
  if (
    elevator.passengers.some(
      (p) => p.destinationFloor === elevator.currentFloor
    )
  ) {
    return true;
  }
  // 2. 是否有外部呼叫在此樓層且與電梯方向一致（或電梯閒置準備接客）
  //    且電梯有容量接客
  if (elevator.passengers.length < elevator.capacity) {
    const hasMatchingFloorCall = state.floorCalls.some(
      (call) =>
        call.floor === elevator.currentFloor &&
        call.personId && // 確保 personId 存在
        state.people.find(
          (p) =>
            p.id === call.personId &&
            p.assignedElevatorId === elevator.id &&
            p.status === 'waiting'
        ) && // 該乘客確實分配給此電梯且在等待
        (elevator.status === 'idle' ||
          call.direction === elevator.currentDirection) // 方向匹配或電梯閒置
    );
    if (hasMatchingFloorCall) {
      return true;
    }
  }
  // 3. 是否 targetFloors 包含當前樓層 (可能來自內部按鈕或先前分配的外部呼叫)
  if (elevator.targetFloors.has(elevator.currentFloor)) {
    return true;
  }
  return false;
}

// 新增輔助函數：獲取下一個目標樓層 (SCAN 策略)
function getNextTarget(elevator: Elevator): FloorNumber | null {
  const { currentFloor, currentDirection, passengers, targetFloors } = elevator;
  let potentialTargets: FloorNumber[] = [];

  // 收集所有相關目標：乘客目的地 + 外部呼叫樓層
  const allTargets = new Set<FloorNumber>(targetFloors);
  for (const p of passengers) {
    allTargets.add(p.destinationFloor);
  }

  if (allTargets.size === 0) return null;

  if (currentDirection === 'up' || currentDirection === 'idle') {
    // 如果閒置，預設向上尋找
    // 向上時，尋找所有在當前樓層之上（包含）的目標
    potentialTargets = Array.from(allTargets)
      .filter((f) => f >= currentFloor)
      .sort((a, b) => a - b);
    if (potentialTargets.length > 0) return potentialTargets[0];
    // 如果上方沒有目標，則尋找下方最遠的目標（準備轉向）
    potentialTargets = Array.from(allTargets).sort((a, b) => b - a); // 降序，取第一個即最遠（最大）
    if (potentialTargets.length > 0) return potentialTargets[0];
  }

  if (currentDirection === 'down' || currentDirection === 'idle') {
    // 如果閒置且上方無目標，則向下尋找
    // 向下時，尋找所有在當前樓層之下（包含）的目標
    potentialTargets = Array.from(allTargets)
      .filter((f) => f <= currentFloor)
      .sort((a, b) => b - a);
    if (potentialTargets.length > 0) return potentialTargets[0];
    // 如果下方沒有目標，則尋找上方最遠的目標（準備轉向）
    potentialTargets = Array.from(allTargets).sort((a, b) => a - b); // 升序，取第一個即最遠（最小）
    if (potentialTargets.length > 0) return potentialTargets[0];
  }
  return null; // 理論上不應到達這裡如果 allTargets 非空
}

function processElevatorStop(state: SimulationState, elevator: Elevator) {
  // 只有在電梯狀態不是 'doorsOpen' 或 doorOpenTime 為 0 時才執行停靠邏輯，避免重複觸發
  if (
    elevator.status === 'doorsOpen' &&
    elevator.doorOpenTime &&
    elevator.doorOpenTime > 0
  ) {
    return;
  }

  elevator.status = 'doorsOpen'; // 改為 doorsOpen
  elevator.doorOpenTime = STOP_TIME_AT_FLOOR;
  // 從 targetFloors 移除當前樓層，因為已經到達
  // 但注意：如果乘客進入後又按了同層，這個邏輯需要小心，通常是離開優先
  // elevator.targetFloors.delete(elevator.currentFloor); // 暫時保留，看 getNextTarget 是否能正確處理

  log(state, {
    message: `電梯 ${elevator.id} 在 ${elevator.currentFloor} 樓停靠開門`,
    elevatorId: elevator.id,
    floor: elevator.currentFloor
  });

  // 乘客下車
  const passengersToDropOff = elevator.passengers.filter(
    (p) => p.destinationFloor === elevator.currentFloor
  );
  for (const person of passengersToDropOff) {
    person.status = 'completed';
    person.dropOffTime = state.currentTime;
    state.peopleCompleted++;
    log(state, {
      message: `${person.id} 在 ${elevator.currentFloor} 樓到達目的地，離開電梯`,
      personId: person.id,
      elevatorId: elevator.id,
      floor: elevator.currentFloor
    });
  }
  elevator.passengers = elevator.passengers.filter(
    (p) => p.destinationFloor !== elevator.currentFloor
  );

  // 乘客進入電梯
  // 從 state.floorCalls 中找到對應此電梯、此樓層的呼叫
  const peopleWaitingForThisElevator = state.people.filter(
    (p) =>
      p.status === 'waiting' &&
      p.sourceFloor === elevator.currentFloor &&
      p.assignedElevatorId === elevator.id
  );

  for (const person of peopleWaitingForThisElevator) {
    if (elevator.passengers.length < elevator.capacity) {
      person.status = 'inElevator';
      person.pickupTime = state.currentTime;
      elevator.passengers.push(person);
      log(state, {
        message: `${person.id} 在 ${elevator.currentFloor} 樓進入電梯 ${elevator.id}`,
        personId: person.id,
        elevatorId: elevator.id,
        floor: elevator.currentFloor
      });
      elevator.targetFloors.add(person.destinationFloor);
      // 從 floorCalls 中移除已被處理的呼叫
      state.floorCalls = state.floorCalls.filter(
        (call) =>
          !(call.personId === person.id && call.floor === person.sourceFloor)
      );
    } else {
      // 電梯已滿，此人需要等待下一次機會 (理論上 assignElevator 應該避免這種情況，但以防萬一)
      log(state, {
        message: `電梯 ${elevator.id} 已滿，${person.id} 在 ${elevator.currentFloor} 樓無法進入，繼續等待`,
        personId: person.id,
        elevatorId: elevator.id,
        floor: elevator.currentFloor
      });
    }
  }
  // 清理 targetFloors 中的當前樓層，因為已經處理完畢
  // 這個操作必須在乘客進入並加入新目標之後，以避免遺漏內部請求
  if (
    elevator.passengers.every(
      (p) => p.destinationFloor !== elevator.currentFloor
    ) &&
    !peopleWaitingForThisElevator.some(
      (p) =>
        p.status === 'waiting' && elevator.passengers.length < elevator.capacity
    )
  ) {
    // 只有在沒有人要在本層下，且沒有等待上電梯的人（或電梯滿了無法上）時，才移除目標
    elevator.targetFloors.delete(elevator.currentFloor);
  }
}

export function runFullSimulation() {
  const state: SimulationState = {
    currentTime: 0, // 從 0 開始計時
    elevators: initializeElevators(),
    people: [],
    floorCalls: [],
    logs: [],
    totalPeopleToSimulate: TOTAL_PEOPLE,
    peopleGenerated: 0,
    peopleCompleted: 0
  };
  let lastLogTime = -1;
  let simulationCycle = 0; // 新增模擬週期計數器
  const MAX_SIMULATION_CYCLES =
    TOTAL_PEOPLE * MAX_FLOOR * ESTIMATED_PROCESSING_TIME;

  log(state, { message: '模擬開始' });

  while (
    state.peopleCompleted < TOTAL_PEOPLE &&
    simulationCycle < MAX_SIMULATION_CYCLES
  ) {
    state.currentTime++; // 時間先推進
    simulationCycle++;

    // 印出目前進度
    if (state.currentTime % 10 === 0 && state.currentTime !== lastLogTime) {
      console.log(
        `[時間 ${state.currentTime}] 已完成: ${state.peopleCompleted}/${TOTAL_PEOPLE}, 已產生: ${state.peopleGenerated}, 電梯狀態:`,
        state.elevators.map((e) => ({
          id: e.id,
          樓層: e.currentFloor,
          狀態: e.status,
          方向:
            e.currentDirection === 'down'
              ? '向下'
              : e.currentDirection === 'up'
                ? '向上'
                : e.currentDirection,
          乘客數: e.passengers.length,
          目標: Array.from(e.targetFloors)
            .sort((a, b) => a - b)
            .join(','),
          開門時間: e.doorOpenTime
        }))
      );
      lastLogTime = state.currentTime;
    }

    // 產生新乘客 (每 PERSON_GENERATION_INTERVAL 秒)
    if (
      state.peopleGenerated < TOTAL_PEOPLE &&
      state.currentTime % PERSON_GENERATION_INTERVAL === 0
    ) {
      const personId = `乘客-${state.peopleGenerated + 1}`;
      const source = randomFloor();
      const dest = randomFloor(source);
      const direction = dest > source ? 'up' : 'down';
      const person: Person = {
        id: personId,
        spawnTime: state.currentTime,
        sourceFloor: source,
        destinationFloor: dest,
        status: 'waiting',
        assignedElevatorId: undefined
      };
      state.people.push(person);
      state.peopleGenerated++;
      const call: FloorCall = {
        floor: source,
        direction,
        requestTime: state.currentTime,
        personId: person.id // 確保每個呼叫都與特定乘客關聯
      };
      // 移除合併 floorCalls 的邏輯，為每個乘客創建獨立的呼叫記錄
      state.floorCalls.push(call);
      log(state, {
        message: `${person.id} 在 ${source} 樓呼叫電梯去 ${dest} 樓 (${direction})`,
        personId: person.id,
        floor: source,
        details: { destination: dest, direction }
      });
    }

    // 為等待中的乘客分配電梯 (他們可能在上一輪未被分配，或新產生)
    // 同時處理 floorCalls 列表
    const unassignedPeople = state.people.filter(
      (p) => p.status === 'waiting' && !p.assignedElevatorId
    );
    for (const person of unassignedPeople) {
      // 找到此人對應的 floorCall (如果有的話，理論上應該有)
      let callForPerson = state.floorCalls.find(
        (fc) => fc.personId === person.id
      );
      if (!callForPerson) {
        // 如果 floorCalls 中沒有此人的直接呼叫記錄 (例如，因為合併了呼叫)
        // 則根據乘客資訊創建一個臨時的 call object 來分配
        callForPerson = {
          floor: person.sourceFloor,
          direction:
            person.destinationFloor > person.sourceFloor ? 'up' : 'down',
          requestTime: person.spawnTime, // 或 currentTime，取決於策略
          personId: person.id
        };
      }
      const assignedElevatorId = assignElevator(state, callForPerson);
      if (assignedElevatorId) {
        person.assignedElevatorId = assignedElevatorId;
        log(state, {
          message: `將 ${person.id} (${person.sourceFloor}樓->${person.destinationFloor}樓) 分配給電梯 ${assignedElevatorId}`,
          personId: person.id,
          elevatorId: assignedElevatorId,
          floor: person.sourceFloor
        });
        // 注意：這裡不從 floorCalls 移除，因為 assignElevator 只是預分配，實際接人時才移除
      } else {
        log(state, {
          message: `${person.id} (${person.sourceFloor}樓->${person.destinationFloor}樓) 暫無可用電梯，繼續等待`,
          personId: person.id,
          floor: person.sourceFloor
        });
      }
    }

    // 處理每部電梯
    for (const elevator of state.elevators) {
      moveElevator(state, elevator); // 傳入 state
    }
    // 檢查是否達到最大週期
    if (
      simulationCycle >= MAX_SIMULATION_CYCLES &&
      state.peopleCompleted < TOTAL_PEOPLE
    ) {
      console.error(
        `模擬超過最大週期 (${MAX_SIMULATION_CYCLES})，可能存在無限迴圈或無法完成的乘客！已完成 ${state.peopleCompleted}/${TOTAL_PEOPLE}`
      );
      log(state, {
        message: `錯誤：模擬超過最大週期 (${MAX_SIMULATION_CYCLES})，強制結束。`
      });
      break;
    }
  }

  log(state, {
    message: `模擬結束於 ${state.currentTime} 秒，共 ${simulationCycle} 週期。已完成 ${state.peopleCompleted} 人。`
  });
  console.log(
    `模擬結束於 ${state.currentTime} 秒。已完成 ${state.peopleCompleted} 人。`
  );

  // 新增：輸出未完成的乘客信息
  const uncompletedPeople = state.people.filter(
    (p) => p.status !== 'completed'
  );
  if (uncompletedPeople.length > 0) {
    console.warn(`警告：有 ${uncompletedPeople.length} 位乘客未完成行程：`);
    log(state, {
      message: `警告：有 ${uncompletedPeople.length} 位乘客未完成行程。`
    });
    for (const person of uncompletedPeople) {
      console.log(
        `  - 乘客 ID: ${person.id}, 狀態: ${person.status}, 
          產生時間: ${person.spawnTime}, 起點: ${person.sourceFloor}, 終點: ${person.destinationFloor}, 
          分配電梯: ${person.assignedElevatorId || '未分配'}, 
          上車時間: ${person.pickupTime || '未上車'}, 下車時間: ${person.dropOffTime || '未下車'}`
      );
      log(state, {
        message: `未完成乘客: ID=${person.id}, 狀態=${person.status}, 起點=${person.sourceFloor}, 終點=${person.destinationFloor}, 分配電梯=${person.assignedElevatorId || '未分配'}`,
        personId: person.id,
        details: {
          status: person.status,
          spawnTime: person.spawnTime,
          sourceFloor: person.sourceFloor,
          destinationFloor: person.destinationFloor,
          assignedElevatorId: person.assignedElevatorId || '未分配',
          pickupTime: person.pickupTime || '未上車',
          dropOffTime: person.dropOffTime || '未下車'
        }
      });
    }
  }

  return {
    totalTime: state.currentTime,
    logs: state.logs,
    people: state.people,
    elevators: state.elevators
  };
}
