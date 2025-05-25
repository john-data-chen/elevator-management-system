// 樓層設定
export const MIN_FLOOR = 1;
export const MAX_FLOOR = 10;

// 電梯設定
export const ELEVATOR_TOTAL = 2;
export const ELEVATOR_CAPACITY = 5;

// 人數
// 每秒生成的人數
export const PERSON_GENERATION_INTERVAL = 1;
export const TOTAL_PEOPLE = 40;

// 時間 (秒)
export const TRAVEL_TIME_PER_FLOOR = 1;
export const STOP_TIME_AT_FLOOR = 1;
export const ESTIMATED_PROCESSING_TIME = 5;
export const MAX_SIMULATION_CYCLES =
  TOTAL_PEOPLE * MAX_FLOOR * ESTIMATED_PROCESSING_TIME;

// 按鈕數
export const BUTTONS_PER_FLOOR = 1;
