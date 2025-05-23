import type { ElevatorId } from './elevator.types';
import type { FloorNumber } from './floor.types';

// Represents a person waiting for or using an elevator
export interface Person {
  id: string; // Unique identifier for the person
  spawnTime: number; // Simulation time when the person appears
  sourceFloor: FloorNumber; // Floor where the person starts
  destinationFloor: FloorNumber; // Floor where the person wants to go
  status: 'waiting' | 'inElevator' | 'completed'; // Current status of the person
  pickupTime?: number; // Simulation time when picked up by an elevator
  dropOffTime?: number; // Simulation time when dropped off at the destination
  assignedElevatorId?: ElevatorId; // ID of the elevator that will pick up this person
}
