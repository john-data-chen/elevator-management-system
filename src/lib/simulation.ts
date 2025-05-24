import {
  ELEVATOR_CAPACITY,
  ELEVATOR_TOTAL,
  MAX_FLOOR,
  MIN_FLOOR,
  PERSON_GENERATION_INTERVAL,
  STOP_TIME_AT_FLOOR,
  TOTAL_PEOPLE
} from '@/constants/simulationConfig';
import type { FloorCall } from '@/types/call.types';
import type { Elevator, ElevatorId } from '@/types/elevator.types';
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
  // SCAN策略：優先選擇同方向且最近的電梯，且有空位
  let bestElevator: Elevator | null = null;
  let minDistance = Number.MAX_SAFE_INTEGER;
  for (const elevator of state.elevators) {
    if (elevator.passengers.length >= elevator.capacity) continue;
    // 電梯方向與呼叫方向一致，或電梯閒置
    const directionMatch =
      elevator.currentDirection === call.direction ||
      elevator.currentDirection === 'idle';
    if (!directionMatch) continue;
    const distance = Math.abs(elevator.currentFloor - call.floor);
    if (distance < minDistance) {
      minDistance = distance;
      bestElevator = elevator;
    }
  }
  if (bestElevator) {
    bestElevator.targetFloors.add(call.floor);
    return bestElevator.id;
  }
  // 若沒有合適電梯，則選擇最近且有空位的電梯
  minDistance = Number.MAX_SAFE_INTEGER;
  for (const elevator of state.elevators) {
    if (elevator.passengers.length >= elevator.capacity) continue;
    const distance = Math.abs(elevator.currentFloor - call.floor);
    if (distance < minDistance) {
      minDistance = distance;
      bestElevator = elevator;
    }
  }
  if (bestElevator) {
    bestElevator.targetFloors.add(call.floor);
    return bestElevator.id;
  }
  // 若全部都滿載，**不分配**，等下次再分配
  return undefined;
}

function moveElevator(elevator: Elevator) {
  if (elevator.targetFloors.size === 0) {
    elevator.status = 'idle';
    elevator.currentDirection = 'idle';
    return;
  }
  const targets = Array.from(elevator.targetFloors);
  const nextFloor = targets.reduce(
    (prev, curr) => {
      if (
        elevator.currentDirection === 'up' ||
        elevator.currentDirection === 'idle'
      ) {
        return curr > elevator.currentFloor && (prev === null || curr < prev)
          ? curr
          : prev;
      }
      return curr < elevator.currentFloor && (prev === null || curr > prev)
        ? curr
        : prev;
    },
    null as number | null
  );
  if (nextFloor == null) {
    // 沒有同方向目標，選最近的
    const closest = targets.reduce(
      (prev, curr) =>
        Math.abs(curr - elevator.currentFloor) <
        Math.abs(prev - elevator.currentFloor)
          ? curr
          : prev,
      targets[0]
    );
    elevator.currentDirection = closest > elevator.currentFloor ? 'up' : 'down';
    elevator.currentFloor += elevator.currentDirection === 'up' ? 1 : -1;
    elevator.status =
      elevator.currentDirection === 'up' ? 'movingUp' : 'movingDown';
  } else {
    elevator.currentDirection =
      nextFloor > elevator.currentFloor ? 'up' : 'down';
    elevator.currentFloor += elevator.currentDirection === 'up' ? 1 : -1;
    elevator.status =
      elevator.currentDirection === 'up' ? 'movingUp' : 'movingDown';
  }
}

function processElevatorStop(state: SimulationState, elevator: Elevator) {
  // 檢查是否需停靠
  if (!elevator.targetFloors.has(elevator.currentFloor)) return;
  elevator.status = 'stopped';
  elevator.doorOpenTime = STOP_TIME_AT_FLOOR;
  elevator.targetFloors.delete(elevator.currentFloor);
  // 乘客下車
  for (const person of elevator.passengers.filter(
    (p) => p.destinationFloor === elevator.currentFloor
  )) {
    person.status = 'completed';
    person.dropOffTime = state.currentTime;
    state.peopleCompleted++;
    log(state, {
      message: `${person.id} 在 ${elevator.currentFloor} 到達目的地，離開電梯`,
      personId: person.id,
      elevatorId: elevator.id,
      floor: elevator.currentFloor
    });
  }
  elevator.passengers = elevator.passengers.filter(
    (p) => p.destinationFloor !== elevator.currentFloor
  );
  // 乘客上車
  const waiting = state.people.filter(
    (p) =>
      p.status === 'waiting' &&
      p.sourceFloor === elevator.currentFloor &&
      p.assignedElevatorId === elevator.id
  );
  for (const person of waiting) {
    if (elevator.passengers.length < elevator.capacity) {
      person.status = 'inElevator';
      person.pickupTime = state.currentTime;
      elevator.passengers.push(person);
      log(state, {
        message: `${person.id} 在 ${elevator.currentFloor} 樓進電梯`,
        personId: person.id,
        elevatorId: elevator.id,
        floor: elevator.currentFloor
      });
      elevator.targetFloors.add(person.destinationFloor);
    }
  }
}

export function runFullSimulation() {
  const state: SimulationState = {
    currentTime: 1,
    elevators: initializeElevators(),
    people: [],
    floorCalls: [],
    logs: [],
    totalPeopleToSimulate: TOTAL_PEOPLE,
    peopleGenerated: 0,
    peopleCompleted: 0
  };
  let lastLogTime = -1;
  while (state.peopleCompleted < TOTAL_PEOPLE) {
    // 印出目前進度
    if (state.currentTime % 10 === 0 && state.currentTime !== lastLogTime) {
      console.log(
        `[Time ${state.currentTime}] Completed: ${state.peopleCompleted}, Generated: ${state.peopleGenerated}, Elevators:`,
        state.elevators.map((e) => ({
          id: e.id,
          floor: e.currentFloor,
          status: e.status,
          passengers: e.passengers.length,
          targets: Array.from(e.targetFloors)
        }))
      );
      lastLogTime = state.currentTime;
    }

    // 產生新乘客
    if (
      state.peopleGenerated < TOTAL_PEOPLE &&
      state.currentTime % PERSON_GENERATION_INTERVAL === 0
    ) {
      const source = randomFloor();
      const dest = randomFloor(source);
      const direction = dest > source ? 'up' : 'down';
      const person: Person = {
        id: `person-${Math.floor(Math.random() * TOTAL_PEOPLE) + 1}`,
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
        personId: person.id
      };
      state.floorCalls.push(call);
      // 分配電梯
      const assignedId = assignElevator(state, call);
      if (assignedId) {
        person.assignedElevatorId = assignedId;
        log(state, {
          message: `${person.id} 在 ${source} 樓 按按鈕，要去 ${dest} 樓`,
          personId: person.id,
          floor: source,
          elevatorId: assignedId
        });
        console.log(
          `[Time ${state.currentTime}]${person.id} assigned to elevator ${assignedId} from ${source} to ${dest}`
        );
      } else {
        // 無法分配，等待下次
        console.log(
          `[Time ${state.currentTime}] Person ${person.id} could not be assigned to any elevator (all full)`
        );
      }
    }
    // 處理每部電梯
    for (const elevator of state.elevators) {
      // 若門開啟中，倒數
      if (elevator.doorOpenTime && elevator.doorOpenTime > 0) {
        elevator.doorOpenTime--;
        if (elevator.doorOpenTime === 0) {
          elevator.status = 'idle';
        }
        continue;
      }
      // 若需停靠
      if (elevator.targetFloors.has(elevator.currentFloor)) {
        processElevatorStop(state, elevator);
        // 追蹤停靠
        console.log(
          `[Time ${state.currentTime}] Elevator ${elevator.id} stopped at floor ${elevator.currentFloor}, passengers: ${elevator.passengers.length}`
        );
        continue;
      }
      // 若有目標樓層，移動
      if (elevator.targetFloors.size > 0) {
        moveElevator(elevator);
        // 追蹤移動
        console.log(
          `[Time ${state.currentTime}] Elevator ${elevator.id} moving to floor ${elevator.currentFloor}, direction: ${elevator.currentDirection}`
        );
      } else {
        elevator.status = 'idle';
        elevator.currentDirection = 'idle';
      }
    }
    state.currentTime++;

    // 疑似問題區：若有乘客永遠無法完成，會造成無限迴圈
    // 建議加上最大迴圈次數保護
    if (state.currentTime > 100000) {
      console.error(
        'Simulation exceeded 100,000 seconds, possible infinite loop!'
      );
      break;
    }
  }
  return {
    totalTime: state.currentTime,
    logs: state.logs,
    people: state.people,
    elevators: state.elevators
  };
}
