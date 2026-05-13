import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchContacts, updateContact, deleteContact, upsertContacts } from '../utils/api';

export const CONTACTS_KEY = ['contacts'];

export function useContacts({ enabled = false } = {}) {
  return useQuery({
    queryKey: CONTACTS_KEY,
    queryFn: fetchContacts,
    enabled,
    staleTime: 30000,
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => updateContact(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: CONTACTS_KEY }),
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteContact,
    onSuccess: () => qc.invalidateQueries({ queryKey: CONTACTS_KEY }),
  });
}

export function useUpsertContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: upsertContacts,
    onSuccess: () => qc.invalidateQueries({ queryKey: CONTACTS_KEY }),
  });
}
