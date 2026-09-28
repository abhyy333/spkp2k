import {
  SAProblemData,
  SASolution,
  SAConfig,
  SAProgress,
  SAResult,
} from '../optimization/simulatedAnnealing/types';
import { SimulatedAnnealingEngine } from '../optimization/simulatedAnnealing/annealing';

let currentEngine: SimulatedAnnealingEngine | null = null;

export type WorkerInMessage =
  | {
      type: 'START';
      problem: SAProblemData;
      initialSolution: SASolution;
      config: SAConfig;
    }
  | {
      type: 'STOP';
    };

export type WorkerOutMessage =
  | {
      type: 'PROGRESS';
      payload: SAProgress;
    }
  | {
      type: 'COMPLETE';
      payload: SAResult;
    }
  | {
      type: 'ERROR';
      error: string;
    };

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;

  if (msg.type === 'START') {
    try {
      currentEngine = new SimulatedAnnealingEngine(msg.problem, msg.initialSolution, msg.config);

      const result = currentEngine.run((progress: SAProgress) => {
        self.postMessage({
          type: 'PROGRESS',
          payload: progress,
        } as WorkerOutMessage);
      }, 80);

      self.postMessage({
        type: 'COMPLETE',
        payload: result,
      } as WorkerOutMessage);
    } catch (err: any) {
      console.error('[SA Worker] Execution error:', err);
      self.postMessage({
        type: 'ERROR',
        error: err?.message || 'Error occurred in Simulated Annealing Worker',
      } as WorkerOutMessage);
    } finally {
      currentEngine = null;
    }
  } else if (msg.type === 'STOP') {
    if (currentEngine) {
      currentEngine.stop();
    }
  }
};
