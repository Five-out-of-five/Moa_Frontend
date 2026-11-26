"use client";

import { Client, type StompSubscription } from "@stomp/stompjs";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";

import { parsePresenceEvent, parseRoomEvent, type PresenceEvent, type RoomEvent } from "./room-event";

type Listener = (event: RoomEvent) => void;
type PresenceListener = (event: PresenceEvent, generation: number) => void;
type Connection = "disabled" | "connecting" | "connected" | "reconnecting";
type RoomRealtime = {
  connection: Connection;
  connectionGeneration: number;
  listen: (listener: Listener) => () => void;
  listenPresence: (listener: PresenceListener) => () => void;
  publish: (destination: string, payload: object) => void;
};

const RoomRealtimeContext = createContext<RoomRealtime | null>(null);

export function useRoomRealtime() {
  return useContext(RoomRealtimeContext);
}

export function RoomRealtimeProvider({ roomId, enabled, url, local, children }: {
  roomId: number; enabled: boolean; url: string | null; local: boolean; children: ReactNode;
}) {
  const [connection, setConnection] = useState<Connection>(enabled ? "connecting" : "disabled");
  const [connectionGeneration, setConnectionGeneration] = useState(0);
  const socket = useRef<Client | null>(null);
  const listeners = useRef(new Set<Listener>());
  const presenceListeners = useRef(new Set<PresenceListener>());
  const presenceSubscription = useRef<StompSubscription | null>(null);
  const generation = useRef(0);

  const listen = useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => { listeners.current.delete(listener); };
  }, []);

  const subscribePresence = useCallback(() => {
    const client = socket.current;
    if (!client?.connected || presenceSubscription.current || !presenceListeners.current.size) return;
    const currentGeneration = generation.current;
    presenceSubscription.current = client.subscribe(`/topic/rooms/${roomId}/presence`, ({ body }) => {
      const event = parsePresenceEvent(body);
      if (event) for (const listener of presenceListeners.current) listener(event, currentGeneration);
    });
  }, [roomId]);

  const listenPresence = useCallback((listener: PresenceListener) => {
    presenceListeners.current.add(listener);
    subscribePresence();
    return () => {
      presenceListeners.current.delete(listener);
      if (presenceListeners.current.size) return;
      if (socket.current?.connected) presenceSubscription.current?.unsubscribe();
      presenceSubscription.current = null;
    };
  }, [subscribePresence]);

  const publish = useCallback((destination: string, payload: object) => {
    const client = socket.current;
    if (client?.connected) client.publish({ destination, body: JSON.stringify(payload) });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const { protocol, host, hostname } = window.location;
    const scheme = protocol === "https:" ? "wss:" : "ws:";
    const brokerURL = url ?? (local ? `${scheme}//${hostname}:8080/ws` : `${scheme}//${host}/ws`);
    const lifetime = new AbortController();
    let shouldRefresh = false;
    let refreshed = false;
    const client = new Client({
      brokerURL,
      heartbeatOutgoing: 20_000,
      heartbeatIncoming: 20_000,
      connectionTimeout: 10_000,
      reconnectDelay: 5_000,
      beforeConnect: async () => {
        if (!shouldRefresh || refreshed || lifetime.signal.aborted) return;
        try {
          const response = await fetch("/api/auth/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ returnPath: window.location.pathname + window.location.search }),
            signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(10_000)]),
          });
          refreshed = response.ok || response.status === 401 || response.status === 403;
        } catch {
          // 다음 연결에서 아직 유효한 쿠키를 먼저 시도한다.
        }
      },
      onConnect: () => {
        if (lifetime.signal.aborted) return;
        shouldRefresh = refreshed = false;
        generation.current += 1;
        client.subscribe(`/topic/rooms/${roomId}`, ({ body }) => {
          const event = parseRoomEvent(body);
          if (event) for (const listener of listeners.current) listener(event);
        });
        subscribePresence();
        setConnection("connected");
        setConnectionGeneration(generation.current);
      },
      onStompError: () => {
        if (lifetime.signal.aborted) return;
        if (!client.connected) shouldRefresh = true;
        setConnection("reconnecting");
        client.forceDisconnect();
      },
      onWebSocketClose: () => {
        if (lifetime.signal.aborted) return;
        presenceSubscription.current = null;
        setConnection("reconnecting");
      },
    });
    socket.current = client;
    client.activate();
    return () => {
      lifetime.abort();
      if (socket.current === client) {
        presenceSubscription.current = null;
        socket.current = null;
      }
      void client.deactivate({ force: true });
    };
  }, [enabled, local, roomId, subscribePresence, url]);

  return <RoomRealtimeContext.Provider value={{ connection, connectionGeneration, listen, listenPresence, publish }}>
    {children}
  </RoomRealtimeContext.Provider>;
}
