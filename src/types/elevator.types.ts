import type { Direction } from './call.types';
import type { FloorNumber } from './floor.types';
import type { Person } from './person.types';

// Represents the unique identifier for an elevator
export type ElevatorId = 'e1' | 'e2'; // Assuming 2 elevators, identified by 0 and 1

// Represents the status of an elevator
export type ElevatorStatus =
  | 'idle'
  | 'movingUp'
  | 'movingDown'
  | 'stopped'
  | 'doorsOpen';

// Represents an elevator in the building
export interface Elevator {
  id: ElevatorId;
  currentFloor: FloorNumber;
  passengers: Person[]; // Array of people currently inside the elevator
  status: ElevatorStatus;
  targetFloors: Set<FloorNumber>; // Set of floors the elevator needs to visit
  readonly capacity: number; // Maximum number of people the elevator can hold (e.g., 5)
  currentDirection: Direction | 'idle'; // Current operational direction
  doorOpenTime?: number; // Simulation time when doors last opened, to manage 1s stop
}
