import type { FloorCall } from './call.types';
import type { Elevator, ElevatorId } from './elevator.types';
import type { FloorNumber } from './floor.types';
import type { Person } from './person.types';

// Represents an entry in the simulation log
export interface SimulationLogEntry {
  time: number; // Current simulation time
  message: string; // Description of the event
  elevatorId?: ElevatorId;
  personId?: string;
  floor?: FloorNumber;
  details?: Record<string, string | number | boolean>; // Additional details for the event
}

// Represents the overall state of the simulation at any given time
export interface SimulationState {
  currentTime: number;
  elevators: Elevator[];
  people: Person[];
  floorCalls: FloorCall[]; // Active calls from floors
  logs: SimulationLogEntry[];
  totalPeopleToSimulate: number;
  peopleGenerated: number;
  peopleCompleted: number;
}
