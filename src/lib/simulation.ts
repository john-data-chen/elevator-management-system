import {
  ELEVATOR_CAPACITY,
  ELEVATOR_TOTAL,
  MAX_FLOOR,
  MAX_SIMULATION_CYCLES,
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
  let bestElevatorDetails = {};

  log(state, {
    message: `為呼叫 (樓層 ${call.floor}, 方向：向${call.direction === 'down' ? '下' : '上'}, 乘客 ${call.personId}) 分配電梯中...`,
    details: {
      callFloor: call.floor,
      callDirection: call.direction,
      personId: call.personId
    }
  });

  for (const elevator of state.elevators) {
    if (
      elevator.passengers.length >= elevator.capacity &&
      elevator.status !== 'idle'
    ) {
      log(state, {
        message: `電梯 ${elevator.id} 已滿 (乘客 ${elevator.passengers.length}/${elevator.capacity}) 且非閒置，跳過分配。`,
        elevatorId: elevator.id,
        details: {
          passengers: elevator.passengers.length,
          capacity: elevator.capacity,
          status: elevator.status
        }
      });
      continue; // 電梯已滿且非閒置，不考慮
    }

    let score = 0;
    const distance = Math.abs(elevator.currentFloor - call.floor);
    let scoreReason = '';

    // 情況1: 電梯閒置
    if (elevator.status === 'idle') {
      score = distance; // 距離越近越好
      scoreReason = `閒置，距離 ${distance}`;
    }
    // 情況2: 電梯與呼叫同方向，且呼叫樓層在電梯路徑上
    else if (elevator.currentDirection === call.direction) {
      if (
        (call.direction === 'up' && call.floor >= elevator.currentFloor) ||
        (call.direction === 'down' && call.floor <= elevator.currentFloor)
      ) {
        // 在前方，距離越近越好
        score = distance; // 基礎分數
        scoreReason = `同向順路，距離 ${distance}`;
      } else {
        // 在後方 (已錯過)，增加懲罰值 (例如，繞一圈的成本)
        score = distance + MAX_FLOOR * 2; // 懲罰較高
        scoreReason = `同向但已錯過，距離 ${distance}，懲罰 +${MAX_FLOOR * 2}`;
      }
    }
    // 情況3: 電梯與呼叫反方向
    else {
      // 電梯即將經過呼叫樓層後轉向，計算總行程
      // 例如：電梯在5樓向下，目標是1樓，呼叫在3樓向上。成本是 (5-1) + (3-1) = 4 + 2 = 6
      // 例如：電梯在3樓向上，目標是10樓，呼叫在5樓向下。成本是 (10-3) + (10-5) = 7 + 5 = 12
      let furthestTargetInCurrentDirection = elevator.currentFloor;
      if (elevator.currentDirection === 'up') {
        furthestTargetInCurrentDirection = Math.max(
          elevator.currentFloor,
          ...Array.from(elevator.targetFloors).filter(
            (f) => f > elevator.currentFloor
          ),
          ...elevator.passengers
            .map((p) => p.destinationFloor)
            .filter((f) => f > elevator.currentFloor)
        );
      } else if (elevator.currentDirection === 'down') {
        furthestTargetInCurrentDirection = Math.min(
          elevator.currentFloor,
          ...Array.from(elevator.targetFloors).filter(
            (f) => f < elevator.currentFloor
          ),
          ...elevator.passengers
            .map((p) => p.destinationFloor)
            .filter((f) => f < elevator.currentFloor)
        );
      }
      const travelToTurnaround = Math.abs(
        furthestTargetInCurrentDirection - elevator.currentFloor
      );
      const travelFromTurnaroundToCall = Math.abs(
        call.floor - furthestTargetInCurrentDirection
      );
      score = travelToTurnaround + travelFromTurnaroundToCall + MAX_FLOOR; // 額外懲罰轉向
      scoreReason = `反向，需到 ${furthestTargetInCurrentDirection} 樓轉向，行程 ${travelToTurnaround}+${travelFromTurnaroundToCall}，懲罰 +${MAX_FLOOR}`;
    }

    // 考慮電梯負載，滿載的電梯分數大幅提高
    if (elevator.passengers.length >= elevator.capacity) {
      score += 1000; // 對滿載電梯施加巨大懲罰
      scoreReason += ', 已滿載懲罰 +1000';
    } else {
      score += elevator.passengers.length * 2; // 乘客越多，分數略高
      scoreReason += `, 乘客數 ${elevator.passengers.length} 懲罰 +${elevator.passengers.length * 2}`;
    }

    // 考慮電梯目標樓層數量 (懲罰目標多的電梯，讓它先完成當前任務)
    score += elevator.targetFloors.size;
    scoreReason += `, 目標數 ${elevator.targetFloors.size} 懲罰 +${elevator.targetFloors.size}`;

    log(state, {
      message: `電梯 ${elevator.id} 評估: 分數 ${score} (原因: ${scoreReason})`,
      elevatorId: elevator.id,
      details: {
        currentFloor: elevator.currentFloor,
        status: elevator.status,
        direction: elevator.currentDirection,
        passengers: elevator.passengers.length,
        targets: Array.from(elevator.targetFloors).join(','),
        calculatedScore: score,
        scoreBreakdown: scoreReason
      }
    });

    if (score < minScore) {
      minScore = score;
      bestElevator = elevator;
      bestElevatorDetails = {
        id: elevator.id,
        score,
        reason: scoreReason,
        currentFloor: elevator.currentFloor,
        status: elevator.status
      };
    }
  }

  if (bestElevator) {
    log(state, {
      message: `選擇電梯 ${bestElevator.id} (分數 ${minScore}) 來處理呼叫 (樓層 ${call.floor}, 方向 ${call.direction}, 乘客 ${call.personId})`,
      elevatorId: bestElevator.id,
      details: {
        ...bestElevatorDetails,
        callFloor: call.floor,
        callDirection: call.direction,
        personId: call.personId
      }
    });
    bestElevator.targetFloors.add(call.floor); // 將呼叫樓層加入目標
    // 如果電梯是閒置的，設定其方向以響應呼叫
    if (bestElevator.status === 'idle') {
      if (call.floor > bestElevator.currentFloor) {
        bestElevator.currentDirection = 'up';
        bestElevator.status = 'movingUp';
      } else if (call.floor < bestElevator.currentFloor) {
        bestElevator.currentDirection = 'down';
        bestElevator.status = 'movingDown';
      } else {
        // 如果剛好在同一層樓，則直接開門處理 (理論上 assign 前應該先檢查)
        bestElevator.status = 'stopped'; // 將在下一 tick 由 processElevatorStop 處理
        log(state, {
          message: `電梯 ${bestElevator.id} 在呼叫樓層 ${call.floor} 且閒置，準備停靠。`,
          elevatorId: bestElevator.id
        });
      }
    }
    return bestElevator.id;
  }

  log(state, {
    message: `沒有合適的電梯來處理呼叫 (樓層 ${call.floor}, 方向 ${call.direction}, 乘客 ${call.personId})`,
    details: {
      callFloor: call.floor,
      callDirection: call.direction,
      personId: call.personId
    }
  });
  return undefined; // 沒有合適的電梯
}

function moveElevator(state: SimulationState, elevator: Elevator) {
  // 處理電梯門開啟狀態
  if (elevator.doorOpenTime && elevator.doorOpenTime > 0) {
    elevator.doorOpenTime--;
    log(state, {
      message: `電梯 ${elevator.id} 在 ${elevator.currentFloor} 樓，門倒數 ${elevator.doorOpenTime} 秒。`,
      elevatorId: elevator.id,
      floor: elevator.currentFloor
    });
    if (elevator.doorOpenTime === 0) {
      log(state, {
        message: `電梯 ${elevator.id} 在 ${elevator.currentFloor} 樓門已關閉。`,
        elevatorId: elevator.id,
        floor: elevator.currentFloor
      });
      // 門關閉後，重新評估方向和狀態
      const nextTarget = getNextTarget(state, elevator); // 傳入 state
      if (nextTarget !== null) {
        if (nextTarget > elevator.currentFloor) {
          elevator.currentDirection = 'up';
          elevator.status = 'movingUp';
        } else if (nextTarget < elevator.currentFloor) {
          elevator.currentDirection = 'down';
          elevator.status = 'movingDown';
        } else {
          // 如果下一個目標是當前樓層 (例如，關門後馬上又有人按同層)，則再次停靠
          log(state, {
            message: `電梯 ${elevator.id} 關門後，下一個目標仍在 ${elevator.currentFloor} 樓，準備再次停靠。`,
            elevatorId: elevator.id,
            floor: elevator.currentFloor
          });
          processElevatorStop(state, elevator);
          return;
        }
      } else {
        elevator.status = 'idle';
        elevator.currentDirection = 'idle';
        log(state, {
          message: `電梯 ${elevator.id} 關門後無目標，轉為閒置。`,
          elevatorId: elevator.id,
          floor: elevator.currentFloor
        });
      }
    }
    return; // 門還在倒數，不做其他事
  }

  // 檢查是否需要在當前樓層停靠
  if (shouldStopAtCurrentFloor(state, elevator)) {
    log(state, {
      message: `電梯 ${elevator.id} 判斷需要在 ${elevator.currentFloor} 樓停靠。`,
      elevatorId: elevator.id,
      floor: elevator.currentFloor
    });
    processElevatorStop(state, elevator);
    return;
  }

  // 決定下一個移動方向和目標
  const nextTarget = getNextTarget(state, elevator); // 傳入 state

  if (nextTarget === null) {
    if (elevator.status !== 'idle') {
      log(state, {
        message: `電梯 ${elevator.id} 在 ${elevator.currentFloor} 樓，無有效目標，轉為閒置。`,
        elevatorId: elevator.id,
        floor: elevator.currentFloor
      });
      elevator.status = 'idle';
      elevator.currentDirection = 'idle';
    }
    return;
  }

  // Move towards next target
  let moved = false;
  if (nextTarget > elevator.currentFloor) {
    if (elevator.status !== 'movingUp' || elevator.currentDirection !== 'up') {
      log(state, {
        message: `電梯 ${elevator.id} 從 ${elevator.currentFloor} 樓開始向上移動至 ${nextTarget} 樓。`,
        elevatorId: elevator.id,
        details: {
          from: elevator.currentFloor,
          to: nextTarget,
          oldStatus: elevator.status,
          oldDir: elevator.currentDirection
        }
      });
    }
    elevator.currentDirection = 'up';
    elevator.status = 'movingUp';
    elevator.currentFloor++;
    moved = true;
  } else if (nextTarget < elevator.currentFloor) {
    if (
      elevator.status !== 'movingDown' ||
      elevator.currentDirection !== 'down'
    ) {
      log(state, {
        message: `電梯 ${elevator.id} 從 ${elevator.currentFloor} 樓開始向下移動至 ${nextTarget} 樓。`,
        elevatorId: elevator.id,
        details: {
          from: elevator.currentFloor,
          to: nextTarget,
          oldStatus: elevator.status,
          oldDir: elevator.currentDirection
        }
      });
    }
    elevator.currentDirection = 'down';
    elevator.status = 'movingDown';
    elevator.currentFloor--;
    moved = true;
  } else {
    // nextTarget is currentFloor, should have been caught by shouldStopAtCurrentFloor
    // This case implies it's already at the target, so stop or re-evaluate
    if (elevator.status !== 'stopped' && elevator.status !== 'doorsOpen') {
      log(state, {
        message: `電梯 ${elevator.id} 已在目標樓層 ${elevator.currentFloor}，但未停靠，強制停靠。`,
        elevatorId: elevator.id,
        floor: elevator.currentFloor
      });
      processElevatorStop(state, elevator);
    }
    return;
  }

  if (moved) {
    log(state, {
      message: `電梯 ${elevator.id} 移動至 ${elevator.currentFloor} 樓 (目標 ${nextTarget})，方向向${elevator.currentDirection === 'down' ? '下' : elevator.currentDirection === 'up' ? '上' : 'idle'}`,
      elevatorId: elevator.id,
      floor: elevator.currentFloor,
      details: {
        target: nextTarget,
        passengers: elevator.passengers.length,
        targetsInSet: Array.from(elevator.targetFloors).join(',')
      }
    });
  }
}

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
    log(state, {
      message: `電梯 ${elevator.id} 應在 ${elevator.currentFloor} 樓停靠：有乘客 (${elevator.passengers
        .filter((p) => p.destinationFloor === elevator.currentFloor)
        .map((p) => p.id)
        .join(',')}) 要下車。`,
      elevatorId: elevator.id,
      floor: elevator.currentFloor
    });
    return true;
  }

  // 2. 是否有已分配給此電梯的外部呼叫在此樓層等待上車
  if (elevator.passengers.length < elevator.capacity) {
    const waitingPersonForThisElevator = state.people.find(
      (p) =>
        p.status === 'waiting' &&
        p.sourceFloor === elevator.currentFloor &&
        p.assignedElevatorId === elevator.id &&
        // 乘客的呼叫方向與電梯當前方向一致，或是電梯閒置，或是電梯即將轉向服務此方向
        (elevator.currentDirection === 'idle' ||
          (p.destinationFloor > p.sourceFloor ? 'up' : 'down') ===
            elevator.currentDirection ||
          // 電梯即將轉向的判斷：沒有更遠的同向目標了
          (elevator.currentDirection === 'up' &&
            !Array.from(elevator.targetFloors).some(
              (tf) => tf > elevator.currentFloor
            ) &&
            !elevator.passengers.some(
              (ps) => ps.destinationFloor > elevator.currentFloor
            )) ||
          (elevator.currentDirection === 'down' &&
            !Array.from(elevator.targetFloors).some(
              (tf) => tf < elevator.currentFloor
            ) &&
            !elevator.passengers.some(
              (ps) => ps.destinationFloor < elevator.currentFloor
            )))
    );
    if (waitingPersonForThisElevator) {
      log(state, {
        message: `電梯 ${elevator.id} 應在 ${elevator.currentFloor} 樓停靠：乘客 ${waitingPersonForThisElevator.id} (分配給此電梯) 等待上車。`,
        elevatorId: elevator.id,
        floor: elevator.currentFloor,
        personId: waitingPersonForThisElevator.id
      });
      return true;
    }
  }

  // 3. 是否 targetFloors (來自未分配呼叫的樓層) 包含當前樓層，且電梯方向匹配或準備轉向
  // 這一條需要謹慎，避免不必要的停靠。優先服務已分配的乘客。
  // 通常 assignElevator 會把 call.floor 加入 targetFloors，這裡主要是處理電梯剛好路過一個未被處理的 targetFloor
  if (
    elevator.targetFloors.has(elevator.currentFloor) &&
    elevator.passengers.length < elevator.capacity
  ) {
    // 檢查是否有對應的 floorCall
    const relevantCall = state.floorCalls.find(
      (call) =>
        call.floor === elevator.currentFloor &&
        (elevator.currentDirection === 'idle' ||
          call.direction === elevator.currentDirection ||
          // 即將轉向的判斷
          (elevator.currentDirection === 'up' &&
            !Array.from(elevator.targetFloors).some(
              (tf) => tf > elevator.currentFloor && tf !== call.floor
            ) &&
            !elevator.passengers.some(
              (ps) => ps.destinationFloor > elevator.currentFloor
            )) ||
          (elevator.currentDirection === 'down' &&
            !Array.from(elevator.targetFloors).some(
              (tf) => tf < elevator.currentFloor && tf !== call.floor
            ) &&
            !elevator.passengers.some(
              (ps) => ps.destinationFloor < elevator.currentFloor
            )))
    );
    if (relevantCall) {
      log(state, {
        message: `電梯 ${elevator.id} 應在 ${elevator.currentFloor} 樓停靠：targetFloors 包含此樓層且有匹配呼叫 ${relevantCall.personId}。`,
        elevatorId: elevator.id,
        floor: elevator.currentFloor,
        details: {
          callPersonId: relevantCall.personId,
          callDirection: relevantCall.direction
        }
      });
      return true;
    }
  }

  return false;
}

function getNextTarget(
  state: SimulationState,
  elevator: Elevator
): FloorNumber | null {
  const { currentFloor, currentDirection, passengers, targetFloors, id } =
    elevator;

  // 收集所有相關目標：乘客目的地 + 外部呼叫樓層 (targetFloors)
  const allTargets = new Set<FloorNumber>();
  for (const p of passengers) {
    allTargets.add(p.destinationFloor);
  }
  for (const floor of targetFloors) {
    allTargets.add(floor);
  }

  if (allTargets.size === 0) {
    log(state, {
      message: `電梯 ${id} (在 ${currentFloor} 樓) getNextTarget: 無任何目標。`,
      elevatorId: id
    });
    return null;
  }

  const targetsArray = Array.from(allTargets);
  let chosenTarget: FloorNumber | null = null;

  if (currentDirection === 'up' || currentDirection === 'idle') {
    // 優先：當前樓層或之上的目標
    const upwardTargets = targetsArray
      .filter((floor) => floor >= currentFloor)
      .sort((a, b) => a - b);
    if (upwardTargets.length > 0) {
      chosenTarget = upwardTargets[0];
      log(state, {
        message: `電梯 ${id} (在 ${currentFloor} 樓, 方向 ${currentDirection}) getNextTarget: 選擇最近的上方目標 ${chosenTarget}。候選: ${upwardTargets.join(',')}`,
        elevatorId: id
      });
    } else {
      // 其次：轉向下，選擇最高的下方目標
      const downwardTargets = targetsArray
        .filter((floor) => floor < currentFloor)
        .sort((a, b) => b - a); // 降序，取第一個即為最高
      if (downwardTargets.length > 0) {
        chosenTarget = downwardTargets[0];
        log(state, {
          message: `電梯 ${id} (在 ${currentFloor} 樓, 方向 ${currentDirection}) getNextTarget: 無上方目標，轉向選擇最高的下方目標 ${chosenTarget}。候選: ${downwardTargets.join(',')}`,
          elevatorId: id
        });
      }
    }
  }

  if (currentDirection === 'down') {
    // 不加 else，因為 idle 情況可能在上面已處理
    // 優先：當前樓層或之下的目標
    const downwardTargets = targetsArray
      .filter((floor) => floor <= currentFloor)
      .sort((a, b) => b - a);
    if (downwardTargets.length > 0) {
      chosenTarget = downwardTargets[0];
      log(state, {
        message: `電梯 ${id} (在 ${currentFloor} 樓, 方向 ${currentDirection}) getNextTarget: 選擇最近的下方目標 ${chosenTarget}。候選: ${downwardTargets.join(',')}`,
        elevatorId: id
      });
    } else {
      // 其次：轉向上，選擇最低的上方目標
      const upwardTargets = targetsArray
        .filter((floor) => floor > currentFloor)
        .sort((a, b) => a - b); // 升序，取第一個即為最低
      if (upwardTargets.length > 0) {
        chosenTarget = upwardTargets[0];
        log(state, {
          message: `電梯 ${id} (在 ${currentFloor} 樓, 方向 ${currentDirection}) getNextTarget: 無下方目標，轉向選擇最低的上方目標 ${chosenTarget}。候選: ${upwardTargets.join(',')}`,
          elevatorId: id
        });
      }
    }
  }

  if (!chosenTarget && targetsArray.length > 0) {
    // 如果上述邏輯都沒選到 (例如 idle 且所有目標都在下方)，則隨便選一個 (實際上 assignElevator 會設定方向)
    chosenTarget = targetsArray[0];
    log(state, {
      message: `電梯 ${id} (在 ${currentFloor} 樓, 方向 ${currentDirection}) getNextTarget: 未按方向邏輯選定，選擇第一個可用目標 ${chosenTarget}。所有目標: ${targetsArray.join(',')}`,
      elevatorId: id
    });
  }

  return chosenTarget;
}

function processElevatorStop(state: SimulationState, elevator: Elevator) {
  if (
    elevator.status === 'doorsOpen' &&
    elevator.doorOpenTime &&
    elevator.doorOpenTime > 0
  ) {
    // 門已經是開的且還在倒數，通常不應該重複進入此函數，但作為保險
    log(state, {
      message: `電梯 ${elevator.id} 在 ${elevator.currentFloor} 樓，processElevatorStop 被呼叫但門已在開啟倒數中 (${elevator.doorOpenTime})。`,
      elevatorId: elevator.id,
      floor: elevator.currentFloor
    });
    return;
  }

  const previousStatus = elevator.status;
  elevator.status = 'doorsOpen';
  elevator.doorOpenTime = STOP_TIME_AT_FLOOR;

  log(state, {
    message: `電梯 ${elevator.id} 在 ${elevator.currentFloor} 樓停靠開門 (先前狀態: ${previousStatus})。門將開啟 ${STOP_TIME_AT_FLOOR} 秒。`,
    elevatorId: elevator.id,
    floor: elevator.currentFloor,
    details: { previousStatus, doorOpenTimeSet: STOP_TIME_AT_FLOOR }
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
      message: `乘客 ${person.id} 在 ${elevator.currentFloor} 樓到達目的地，離開電梯 ${elevator.id}。已完成 ${state.peopleCompleted}/${TOTAL_PEOPLE}。`,
      personId: person.id,
      elevatorId: elevator.id,
      floor: elevator.currentFloor
    });
  }
  elevator.passengers = elevator.passengers.filter(
    (p) => p.destinationFloor !== elevator.currentFloor
  );

  // 乘客進入電梯 (只接分配給此電梯的)
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
        message: `乘客 ${person.id} 在 ${elevator.currentFloor} 樓進入電梯 ${elevator.id} (前往 ${person.destinationFloor} 樓)。電梯內人數: ${elevator.passengers.length}/${elevator.capacity}`,
        personId: person.id,
        elevatorId: elevator.id,
        floor: elevator.currentFloor,
        details: {
          destination: person.destinationFloor,
          passengersInElevator: elevator.passengers.length
        }
      });
      elevator.targetFloors.add(person.destinationFloor);
      // 從 floorCalls 中移除已被處理的呼叫 (對應此人此樓層的)
      const callIndex = state.floorCalls.findIndex(
        (call) =>
          call.personId === person.id && call.floor === person.sourceFloor
      );
      if (callIndex > -1) {
        log(state, {
          message: `從 floorCalls 移除乘客 ${person.id} 在 ${person.sourceFloor} 樓的呼叫。`,
          personId: person.id,
          floor: person.sourceFloor
        });
        state.floorCalls.splice(callIndex, 1);
      } else {
        log(state, {
          message: `警告：乘客 ${person.id} 在 ${person.sourceFloor} 樓進入電梯，但在 floorCalls 中未找到其呼叫記錄。`,
          personId: person.id,
          floor: person.sourceFloor
        });
      }
    } else {
      log(state, {
        message: `電梯 ${elevator.id} 已滿 (乘客 ${elevator.passengers.length}/${elevator.capacity})，乘客 ${person.id} 在 ${elevator.currentFloor} 樓無法進入，繼續等待。`,
        personId: person.id,
        elevatorId: elevator.id,
        floor: elevator.currentFloor,
        details: { passengersInElevator: elevator.passengers.length }
      });
      // 乘客無法進入，將其 assignedElevatorId 清除，以便下一輪重新分配
      // 並且確保其呼叫仍在 floorCalls 中，或重新加入
      person.assignedElevatorId = undefined;
      const existingCall = state.floorCalls.find(
        (fc) => fc.personId === person.id
      );
      if (!existingCall) {
        const newCallForWaitingPerson: FloorCall = {
          floor: person.sourceFloor,
          direction:
            person.destinationFloor > person.sourceFloor ? 'up' : 'down',
          requestTime: person.spawnTime, // 保留原始呼叫時間
          personId: person.id
        };
        state.floorCalls.push(newCallForWaitingPerson);
        log(state, {
          message: `乘客 ${person.id} 因電梯滿無法進入，重新加入 floorCalls 進行分配。`,
          personId: person.id,
          floor: person.sourceFloor
        });
      } else {
        log(state, {
          message: `乘客 ${person.id} 因電梯滿無法進入，其呼叫已在 floorCalls 中，等待重新分配。`,
          personId: person.id,
          floor: person.sourceFloor
        });
      }
    }
  }

  // 清理 targetFloors 中的當前樓層 (因為已經停靠處理了)
  if (elevator.targetFloors.has(elevator.currentFloor)) {
    log(state, {
      message: `電梯 ${elevator.id} 已在 ${elevator.currentFloor} 樓停靠，從 targetFloors 移除此樓層。`,
      elevatorId: elevator.id,
      floor: elevator.currentFloor
    });
    elevator.targetFloors.delete(elevator.currentFloor);
  }
}

export function runFullSimulation() {
  const state: SimulationState = {
    currentTime: 0,
    elevators: initializeElevators(),
    people: [],
    floorCalls: [],
    logs: [],
    totalPeopleToSimulate: TOTAL_PEOPLE,
    peopleGenerated: 0,
    peopleCompleted: 0
  };
  let lastLogTime = -1;
  let simulationCycle = 0;

  log(state, { message: '模擬開始' });

  while (
    state.peopleCompleted < TOTAL_PEOPLE &&
    simulationCycle < MAX_SIMULATION_CYCLES
  ) {
    state.currentTime++;
    simulationCycle++;

    if (state.currentTime % 10 === 0 && state.currentTime !== lastLogTime) {
      console.log(
        `[時間 ${state.currentTime}] 完成: ${state.peopleCompleted}/${TOTAL_PEOPLE}, 產生: ${state.peopleGenerated}, 呼叫佇列: ${state.floorCalls.length}, 週期: ${simulationCycle}`
      );
      for (const e of state.elevators) {
        console.log(
          `  電梯 ${e.id}: 樓層 ${e.currentFloor}, 狀態 ${e.status}, 方向 ${e.currentDirection}, 乘客 ${e.passengers.length} (${e.passengers.map((p) => p.id).join(',')}), 目標 ${Array.from(
            e.targetFloors
          )
            .sort((a, b) => a - b)
            .join(',')}, 門 ${e.doorOpenTime}`
        );
      }
      lastLogTime = state.currentTime;
    }

    // 產生新乘客
    if (
      state.peopleGenerated < TOTAL_PEOPLE &&
      state.currentTime % PERSON_GENERATION_INTERVAL === 0
    ) {
      const personId = `Person-${state.peopleGenerated + 1}`;
      const source = randomFloor();
      const dest = randomFloor(source);
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
        direction: dest > source ? 'up' : 'down',
        requestTime: state.currentTime,
        personId: person.id
      };
      state.floorCalls.push(call);
      log(state, {
        message: `乘客 ${person.id} 在 ${source} 樓呼叫電梯前往 ${dest} 樓 (方向：${call.direction === 'down' ? '向下' : '向上'})。`,
        personId: person.id,
        floor: source,
        details: {
          destination: dest,
          direction: call.direction,
          totalGenerated: state.peopleGenerated
        }
      });
    }

    // 為等待中的乘客 (新產生或之前未分配成功的) 分配電梯
    // 只處理 floorCalls 裡的，因為 assignElevator 會把呼叫樓層加入電梯 targetFloors
    // 並且 processElevatorStop 會在乘客上車後移除 floorCall
    const callsToProcess = [...state.floorCalls]; // 複製一份以避免在迭代時修改
    for (const call of callsToProcess) {
      const person = state.people.find((p) => p.id === call.personId);
      if (person && person.status === 'waiting' && !person.assignedElevatorId) {
        log(state, {
          message: `處理乘客 ${person.id} 的呼叫 (從 ${call.floor} 樓)。`,
          personId: person.id,
          floor: call.floor
        });
        const assignedElevatorId = assignElevator(state, call);
        if (assignedElevatorId) {
          person.assignedElevatorId = assignedElevatorId;
          log(state, {
            message: `乘客 ${person.id} (${person.sourceFloor}->${person.destinationFloor}) 已分配給電梯 ${assignedElevatorId}。`,
            personId: person.id,
            elevatorId: assignedElevatorId,
            floor: person.sourceFloor
          });
          // 不在此處移除 floorCall，assignElevator 僅是預分配，實際接人(processElevatorStop)時才移除
        } else {
          log(state, {
            message: `乘客 ${person.id} (${person.sourceFloor}->${person.destinationFloor}) 暫無可用電梯，於 ${call.floor} 樓繼續等待。`,
            personId: person.id,
            floor: call.floor
          });
        }
      }
    }

    // 處理每部電梯
    for (const elevator of state.elevators) {
      moveElevator(state, elevator);
    }

    if (
      simulationCycle >= MAX_SIMULATION_CYCLES &&
      state.peopleCompleted < TOTAL_PEOPLE
    ) {
      console.error(
        `錯誤：模擬達到最大週期 (${MAX_SIMULATION_CYCLES}) 但未完成所有乘客。已完成 ${state.peopleCompleted}/${TOTAL_PEOPLE}`
      );
      log(state, {
        message: `錯誤：模擬超過最大週期 (${MAX_SIMULATION_CYCLES})，強制結束。`,
        details: { completed: state.peopleCompleted, total: TOTAL_PEOPLE }
      });
      break;
    }
  }

  log(state, {
    message: `模擬結束於 ${state.currentTime} 秒，共 ${simulationCycle} 週期。已完成 ${state.peopleCompleted} 人。`,
    details: {
      totalTime: state.currentTime,
      cycles: simulationCycle,
      completed: state.peopleCompleted
    }
  });
  console.log(
    `模擬結束於 ${state.currentTime} 秒。已完成 ${state.peopleCompleted}/${TOTAL_PEOPLE} 人。`
  );

  const uncompletedPeople = state.people.filter(
    (p) => p.status !== 'completed'
  );
  if (uncompletedPeople.length > 0) {
    console.warn(`警告：有 ${uncompletedPeople.length} 位乘客未完成行程：`);
    log(state, {
      message: `警告：有 ${uncompletedPeople.length} 位乘客未完成行程。`,
      details: { uncompletedCount: uncompletedPeople.length }
    });
    for (const person of uncompletedPeople) {
      console.log(
        `  - 乘客 ID: ${person.id}, 狀態: ${person.status}, ` +
          `產生時間: ${person.spawnTime}, 起點: ${person.sourceFloor}, 終點: ${person.destinationFloor}, ` +
          `分配電梯: ${person.assignedElevatorId || '未分配'}, ` +
          `上車時間: ${person.pickupTime || '未上車'}, 下車時間: ${person.dropOffTime || '未下車'}`
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
