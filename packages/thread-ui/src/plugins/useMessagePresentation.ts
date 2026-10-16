import { useEffect, useMemo, useState } from 'react';
import type {
  MessagePresentation,
  MessagePresentationContext,
} from './plugin-types';
import { usePlugins } from './usePlugins';

/** Validate asynchronously without ever displaying a derivative for an old source. */
export function useMessagePresentation(context: MessagePresentationContext) {
  const { presentMessage } = usePlugins();
  const { item, streaming } = context;
  const candidate = useMemo(
    () => presentMessage({ item, streaming }),
    [presentMessage, item, streaming],
  );
  const [validation, setValidation] = useState<{
    candidate: MessagePresentation;
    valid: boolean;
  } | null>(null);
  const [original, setOriginal] = useState<{
    messageId: string;
    presentationId: string;
  } | null>(null);

  useEffect(() => {
    if (!candidate?.validate) return;
    let active = true;
    void Promise.resolve()
      .then(() => candidate.validate!())
      .then((valid) => {
        if (active) setValidation({ candidate, valid });
      })
      .catch(() => {
        if (active) setValidation({ candidate, valid: false });
      });
    return () => {
      active = false;
    };
  }, [candidate]);

  const presentation =
    candidate &&
    (!candidate.validate ||
      (validation?.candidate === candidate && validation.valid))
      ? candidate
      : null;
  const showingOriginal =
    !presentation ||
    (original?.messageId === item.id &&
      original.presentationId === presentation.id);
  return {
    presentation,
    showingOriginal,
    text: showingOriginal ? item.text : presentation!.text,
    showOriginal: (show: boolean) =>
      setOriginal(
        show && presentation
          ? { messageId: item.id, presentationId: presentation.id }
          : null,
      ),
  };
}
