'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getToken } from './auth';
import type {
  EventType,
  AlertEvent,
  WorkflowUpdateEvent,
  ContentStatusEvent,
  SystemMetricEvent,
  ConnectionEvent,
} from './event-types';

// ─── Types ───

type SSEStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

type SSEOptions = {
  /**
   * Map of event type names to handler callbacks.
   * Each handler receives the parsed JSON data from the SSE message.
   */
  onEvent?: Record<string, (data: unknown) => void>;

  /**
   * Whether the connection should be active. Defaults to true.
   * Set to false to pause the SSE connection.
   */
  enabled?: boolean;

  /**
   * Maximum number of reconnection attempts before giving up.
   * Defaults to Infinity (never gives up).
   */
  maxRetries?: number;
};

type SSEState = {
  /** The last event received from the stream. */
  lastEvent: unknown;
  /** Whether the EventSource is currently connected. */
  isConnected: boolean;
  /** Current connection status. */
  status: SSEStatus;
  /** The last error encountered, if any. */
  error: string | null;
};

// ─── Constants ───

const INITIAL_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;

// ─── useSSE Hook ───

/**
 * Generic SSE client hook that manages an EventSource connection
 * with automatic reconnection using exponential backoff.
 *
 * @param url - The SSE endpoint URL (relative or absolute).
 * @param options - Configuration options.
 * @returns Connection state and the last received event.
 */
export function useSSE(url: string, options: SSEOptions = {}): SSEState {
  const { onEvent, enabled = true, maxRetries = Infinity } = options;

  const [lastEvent, setLastEvent] = useState<unknown>(null);
  const [status, setStatus] = useState<SSEStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);

  // Refs for values that should not trigger reconnection
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const retryDelayRef = useRef(INITIAL_RETRY_MS);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const cleanup = useCallback(() => {
    if (retryTimeoutRef.current !== null) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      cleanup();
      setStatus('disconnected');
      return;
    }

    function connect() {
      // Build URL with auth token as query param since EventSource
      // does not support custom headers.
      const token = getToken();
      const separator = url.includes('?') ? '&' : '?';
      const authedUrl = token ? `${url}${separator}token=${encodeURIComponent(token)}` : url;

      setStatus('connecting');
      setError(null);

      const es = new EventSource(authedUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        setStatus('connected');
        setError(null);
        // Reset backoff on successful connection
        retryDelayRef.current = INITIAL_RETRY_MS;
        retryCountRef.current = 0;
      };

      // Listen for the 'connected' event (initial handshake)
      es.addEventListener('connected', (e: MessageEvent) => {
        try {
          const data: unknown = JSON.parse(e.data);
          setLastEvent(data);
          onEventRef.current?.['connected']?.(data);
        } catch {
          // Ignore parse errors on connection event
        }
      });

      // Listen for typed events
      const eventTypes: EventType[] = ['alert', 'workflow-update', 'content-status', 'system-metric'];
      for (const eventType of eventTypes) {
        es.addEventListener(eventType, (e: MessageEvent) => {
          try {
            const data: unknown = JSON.parse(e.data);
            setLastEvent(data);
            onEventRef.current?.[eventType]?.(data);
          } catch {
            // Ignore parse errors
          }
        });
      }

      // Generic message handler for unnamed events
      es.onmessage = (e: MessageEvent) => {
        try {
          const data: unknown = JSON.parse(e.data);
          setLastEvent(data);
          onEventRef.current?.['message']?.(data);
        } catch {
          // Ignore parse errors
        }
      };

      es.onerror = () => {
        // EventSource automatically attempts to reconnect on error,
        // but we manage it ourselves for exponential backoff.
        es.close();
        eventSourceRef.current = null;
        setStatus('error');

        if (retryCountRef.current >= maxRetries) {
          setError(`Connection failed after ${maxRetries} retries`);
          setStatus('disconnected');
          return;
        }

        const delay = retryDelayRef.current;
        setError(`Connection lost. Reconnecting in ${Math.round(delay / 1000)}s...`);

        retryTimeoutRef.current = setTimeout(() => {
          retryCountRef.current++;
          retryDelayRef.current = Math.min(delay * BACKOFF_MULTIPLIER, MAX_RETRY_MS);
          connect();
        }, delay);
      };
    }

    connect();

    return () => {
      cleanup();
    };
  }, [url, enabled, maxRetries, cleanup]);

  return {
    lastEvent,
    isConnected: status === 'connected',
    status,
    error,
  };
}

// ─── Typed System Events State ───

type SystemEventsState = {
  /** Last alert event received. */
  alert: AlertEvent | null;
  /** Last workflow update event received. */
  workflowUpdate: WorkflowUpdateEvent | null;
  /** Last content status event received. */
  contentStatus: ContentStatusEvent | null;
  /** Last system metric event received. */
  systemMetric: SystemMetricEvent | null;
  /** Connection event received on initial connect. */
  connection: ConnectionEvent | null;
  /** Whether the SSE connection is active. */
  isConnected: boolean;
  /** Current connection status. */
  status: SSEStatus;
  /** Error message if any. */
  error: string | null;
};

/**
 * Convenience hook that connects to the system events SSE endpoint
 * and returns the last received event for each type.
 *
 * Connects to: /api/v1/events/stream
 */
export function useSystemEvents(): SystemEventsState {
  const [alert, setAlert] = useState<AlertEvent | null>(null);
  const [workflowUpdate, setWorkflowUpdate] = useState<WorkflowUpdateEvent | null>(null);
  const [contentStatus, setContentStatus] = useState<ContentStatusEvent | null>(null);
  const [systemMetric, setSystemMetric] = useState<SystemMetricEvent | null>(null);
  const [connection, setConnection] = useState<ConnectionEvent | null>(null);

  const onEvent = useRef<Record<string, (data: unknown) => void>>({
    'connected': (data) => setConnection(data as ConnectionEvent),
    'alert': (data) => setAlert(data as AlertEvent),
    'workflow-update': (data) => setWorkflowUpdate(data as WorkflowUpdateEvent),
    'content-status': (data) => setContentStatus(data as ContentStatusEvent),
    'system-metric': (data) => setSystemMetric(data as SystemMetricEvent),
  });

  const { isConnected, status, error } = useSSE('/api/v1/events/stream', {
    onEvent: onEvent.current,
  });

  return {
    alert,
    workflowUpdate,
    contentStatus,
    systemMetric,
    connection,
    isConnected,
    status,
    error,
  };
}
