import { useState, useEffect, useRef } from 'react';
import { LiveMatch } from '@/components/sports/LiveMatchCard';
import { liveDataSimulator } from '@/lib/sports/liveDataSimulator';

export interface UseLiveDataSimulatorOptions {
  enabled?: boolean;
  updateInterval?: number;
  autoStart?: boolean;
}

export function useLiveDataSimulator(
  initialMatches: LiveMatch[],
  options: UseLiveDataSimulatorOptions = {}
) {
  const {
    enabled = true,
    updateInterval = 5000,
    autoStart = true
  } = options;

  const [matches, setMatches] = useState<LiveMatch[]>(initialMatches);
  const [isRunning, setIsRunning] = useState(autoStart && enabled);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startSimulation = () => {
    if (!enabled) return;
    setIsRunning(true);
  };

  const stopSimulation = () => {
    setIsRunning(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const resetMatches = () => {
    setMatches(initialMatches);
  };

  useEffect(() => {
    if (!isRunning || !enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setMatches(currentMatches => {
        return currentMatches.map(match => {
          // 只对 status.isLive = true 的比赛进行实时模拟
          if (match.status.isLive) {
            return liveDataSimulator.updateMatch(match);
          }
          // preGame 和其他状态的比赛保持不变
          return match;
        });
      });
    }, updateInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, enabled, updateInterval]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    matches,
    isRunning,
    startSimulation,
    stopSimulation,
    resetMatches,
    setMatches
  };
}