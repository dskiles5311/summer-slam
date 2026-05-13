import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchSettings, saveSettings } from '../utils/api';

export const SETTINGS_KEY = ['settings'];

export function useSettings({ refetchInterval } = {}) {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: fetchSettings,
    refetchInterval,
    refetchIntervalInBackground: false,
    staleTime: 2000,
  });
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveSettings,
    onMutate: async (newSettings) => {
      await qc.cancelQueries({ queryKey: SETTINGS_KEY });
      const prev = qc.getQueryData(SETTINGS_KEY);
      qc.setQueryData(SETTINGS_KEY, newSettings);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(SETTINGS_KEY, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}
