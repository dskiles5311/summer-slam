import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchEntries, createEntry, updateEntry, deleteEntry,
  clearWeighLog, backfillPhones, normalizePhones,
  clearAllEntries, createEntriesBulk,
} from '../utils/api';
import { CONTACTS_KEY } from './useContacts';

export const ENTRIES_KEY = ['entries'];

export function useEntries({ refetchInterval } = {}) {
  return useQuery({
    queryKey: ENTRIES_KEY,
    queryFn: fetchEntries,
    refetchInterval,
    refetchIntervalInBackground: false,
    staleTime: 2000,
  });
}

export function useCreateEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createEntry,
    onSuccess: (created) => {
      qc.setQueryData(ENTRIES_KEY, old => [...(old || []), created]);
    },
  });
}

export function useUpdateEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updateEntry(id, data),
    onMutate: async ({ id, data }) => {
      await qc.cancelQueries({ queryKey: ENTRIES_KEY });
      const prev = qc.getQueryData(ENTRIES_KEY);
      qc.setQueryData(ENTRIES_KEY, old =>
        (old || []).map(e => e.id === id ? { ...e, ...data } : e)
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(ENTRIES_KEY, ctx.prev);
    },
    onSuccess: (updated) => {
      qc.setQueryData(ENTRIES_KEY, old =>
        (old || []).map(e => e.id === updated.id ? updated : e)
      );
    },
  });
}

export function useDeleteEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteEntry,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ENTRIES_KEY });
      const prev = qc.getQueryData(ENTRIES_KEY);
      qc.setQueryData(ENTRIES_KEY, old => (old || []).filter(e => e.id !== id));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(ENTRIES_KEY, ctx.prev);
    },
  });
}

export function useClearWeighLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clearWeighLog,
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ENTRIES_KEY });
      const prev = qc.getQueryData(ENTRIES_KEY);
      qc.setQueryData(ENTRIES_KEY, old =>
        (old || []).map(e => ({ ...e, weighedAt: null, rawWeight: null, deadFish: 0, shortFish: 0 }))
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(ENTRIES_KEY, ctx.prev);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ENTRIES_KEY }),
  });
}

export function useClearAllEntries() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: clearAllEntries,
    onSuccess: () => qc.setQueryData(ENTRIES_KEY, []),
  });
}

export function useCreateEntriesBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createEntriesBulk,
    onSuccess: () => qc.invalidateQueries({ queryKey: ENTRIES_KEY }),
  });
}

export function useBackfillPhones() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: backfillPhones,
    onSuccess: () => qc.invalidateQueries({ queryKey: ENTRIES_KEY }),
  });
}

export function useNormalizePhones() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: normalizePhones,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ENTRIES_KEY });
      qc.invalidateQueries({ queryKey: CONTACTS_KEY });
    },
  });
}
