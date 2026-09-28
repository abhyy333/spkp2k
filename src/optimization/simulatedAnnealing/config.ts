import { SAConfig, SAWeights } from './types';

export const DEFAULT_SA_WEIGHTS: SAWeights = {
  // Hard Constraints (Weights: 10,000 each)
  hc1RoomOverlap: 10000,
  hc2LecturerOverlap: 10000,
  hc3ClassGroupConflict: 10000,
  hc4CapacityExceeded: 10000,
  hc5RoomTypeMismatch: 10000,
  hc6LecturerUnavailable: 10000,
  hc7InvalidSlotSequence: 10000,
  hc8FridayPrayer: 10000,
  hc9InactiveRoom: 10000,

  // Soft Constraints
  sc1LecturerAvoidPreference: 80,
  sc1LecturerPreferredBonus: -40,
  sc2RoomWaste: 1, // per seat difference
  sc3LecturerDailyOverload: 50,
  sc4CohortDaySpread: 15,
};

export const SA_DEFAULT_CONFIG: SAConfig = {
  initialTemperature: 100,
  coolingRate: 0.985,
  minTemperature: 0.01,
  maxIterations: 3000,
  seed: 42,
  weights: DEFAULT_SA_WEIGHTS,
  stopOnZeroHardConflicts: false,
};

export interface SAPreset {
  id: string;
  name: string;
  description: string;
  config: Partial<SAConfig>;
}

export const SA_PRESETS: SAPreset[] = [
  {
    id: 'FAST',
    name: 'Cepat (Eksplorasi Awal)',
    description: '1,000 iterasi — untuk konvergensi cepat dan verifikasi struktur jadwal.',
    config: {
      initialTemperature: 60,
      coolingRate: 0.97,
      minTemperature: 0.05,
      maxIterations: 1000,
    },
  },
  {
    id: 'BALANCED',
    name: 'Standar (Rekomendasi)',
    description: '3,000 iterasi — keseimbangan optimal antara eliminasi bentrok dan kecepatan.',
    config: {
      initialTemperature: 120,
      coolingRate: 0.985,
      minTemperature: 0.01,
      maxIterations: 3000,
    },
  },
  {
    id: 'DEEP',
    name: 'Optimal (Penyusunan Penuh)',
    description: '6,000 iterasi — pencarian mendalam untuk jadwal yang sepenuhnya bersih.',
    config: {
      initialTemperature: 250,
      coolingRate: 0.992,
      minTemperature: 0.005,
      maxIterations: 6000,
    },
  },
];
