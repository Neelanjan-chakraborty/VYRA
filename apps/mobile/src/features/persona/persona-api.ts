import { useMutation, useQuery } from '@tanstack/react-query';
import {
  assistantReflectionResponseSchema,
  consentListSchema,
  personaViewSchema,
  type AssistantId,
  type PersonaEdit,
  type PersonaView,
  type ToggleableConsent,
} from '@vyra/validation';
import { api } from '@/lib/api';
import { queryClient } from '@/lib/query-client';

const PERSONA_KEY = ['persona'] as const;
const CONSENTS_KEY = ['consents'] as const;

function isWorking(view: PersonaView | undefined): boolean {
  return view?.generation.status === 'queued' || view?.generation.status === 'generating';
}

export function usePersona() {
  return useQuery({
    queryKey: PERSONA_KEY,
    queryFn: () => api('/me/persona', { schema: personaViewSchema }),
    // Poll only while a draft is being prepared.
    refetchInterval: (query) => (isWorking(query.state.data) ? 1500 : false),
  });
}

function setPersona(view: PersonaView): void {
  queryClient.setQueryData(PERSONA_KEY, view);
}

export function useGeneratePersona() {
  return useMutation({
    mutationFn: () => api('/me/persona/generate', { method: 'POST', schema: personaViewSchema }),
    onSuccess: setPersona,
  });
}

export function useEditPersona() {
  return useMutation({
    mutationFn: (edit: PersonaEdit) =>
      api('/me/persona/draft', { method: 'PATCH', body: edit, schema: personaViewSchema }),
    onSuccess: setPersona,
  });
}

export function useApprovePersona() {
  return useMutation({
    mutationFn: () =>
      api('/me/persona/draft/approve', { method: 'POST', schema: personaViewSchema }),
    onSuccess: setPersona,
  });
}

export function useDiscardDraft() {
  return useMutation({
    mutationFn: () => api('/me/persona/draft', { method: 'DELETE', schema: personaViewSchema }),
    onSuccess: setPersona,
  });
}

export function useClearPersona() {
  return useMutation({
    mutationFn: () => api('/me/persona', { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PERSONA_KEY }),
  });
}

export function useAssistantReflection() {
  return useMutation({
    mutationFn: (input: { assistant: AssistantId; reply: string }) =>
      api('/me/persona/assistant-reflection', {
        method: 'POST',
        body: input,
        schema: assistantReflectionResponseSchema,
      }),
    onSuccess: (response) => setPersona(response.persona),
  });
}

export function useConsents() {
  return useQuery({
    queryKey: CONSENTS_KEY,
    queryFn: () => api('/me/consents', { schema: consentListSchema }),
  });
}

export function useSetConsent() {
  return useMutation({
    mutationFn: ({ type, granted }: { type: ToggleableConsent; granted: boolean }) =>
      api(`/me/consents/${type}`, { method: 'PUT', body: { granted }, schema: consentListSchema }),
    onSuccess: (list) => {
      queryClient.setQueryData(CONSENTS_KEY, list);
      // Withdrawing AI consent deletes drafts on the server.
      void queryClient.invalidateQueries({ queryKey: PERSONA_KEY });
    },
  });
}

export function hasConsent(
  list: { consents: { type: string; granted: boolean }[] } | undefined,
  type: ToggleableConsent,
): boolean {
  return list?.consents.some((c) => c.type === type && c.granted) ?? false;
}
