import { invoke } from '@tauri-apps/api/tauri';
import { IctWinRate, IctHeatmapData } from '../types/ict';

export const getIctWinRates = async (): Promise<IctWinRate[]> => {
  try {
    return await invoke('get_ict_win_rates');
  } catch (error) {
    console.error('Failed to get ICT win rates:', error);
    throw error;
  }
};

export const getIctHeatmapData = async (): Promise<IctHeatmapData[]> => {
  try {
    return await invoke('get_ict_heatmap_data');
  } catch (error) {
    console.error('Failed to get ICT heatmap data:', error);
    throw error;
  }
};

export const transformHeatmapData = (data: IctHeatmapData[]) => {
  const patterns = [...new Set(data.map(item => item.pattern))];
  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  const transformed = patterns.map(pattern => {
    const patternData: any = { pattern };
    daysOfWeek.forEach(day => {
      const dayData = data.find(d => d.pattern === pattern && d.day_of_week === day);
      patternData[day] = dayData ? dayData.win_rate : 0;
    });
    return patternData;
  });

  return { transformed, patterns, daysOfWeek };
};

export const getWinRateColor = (winRate: number): string => {
  if (winRate >= 70) return 'bg-green-500';
  if (winRate >= 60) return 'bg-green-400';
  if (winRate >= 50) return 'bg-yellow-400';
  if (winRate >= 40) return 'bg-orange-400';
  return 'bg-red-400';
};

export const getWinRateTextColor = (winRate: number): string => {
  if (winRate >= 70) return 'text-green-700';
  if (winRate >= 60) return 'text-green-600';
  if (winRate >= 50) return 'text-yellow-600';
  if (winRate >= 40) return 'text-orange-600';
  return 'text-red-600';
};