import type { FloorNumber } from './floor.types';

// Represents the direction of an elevator or a passenger's request
export type Direction = 'up' | 'down';

// Represents a call button press on a floor
export interface FloorCall {
  floor: FloorNumber;
  direction: Direction; // Direction requested by the passenger
  requestTime: number; // Simulation time when the button was pressed
  personId: string; // ID of the person who made the call
}
