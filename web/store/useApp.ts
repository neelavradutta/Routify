'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import toast from 'react-hot-toast';
import { api, ApiError, type Place, type Plan, type PlanRequest, type Route } from '@/lib/api';

type Endpoint = 'from' | 'to';

type State = {
  token: string | null;
  email: string | null;
  ready: boolean;

  from: Place | null;
  to: Place | null;
  pick: Endpoint;

  night: boolean;
  avoidUnlit: boolean;
  avoidIsolated: boolean;

  plan: Plan | null;
  selected: Route['id'];
  hovered: number | null;
  showZones: boolean;

  explanation: { text: string; source: 'ai' | 'rules' } | null;
  planning: boolean;
  explaining: boolean;

  signIn: (mode: 'login' | 'register', email: string, password: string) => Promise<void>;
  signOut: () => void;
  restore: () => Promise<void>;

  setPlace: (which: Endpoint, place: Place | null) => void;
  swap: () => void;
  setPick: (which: Endpoint) => void;
  toggle: (key: 'night' | 'avoidUnlit' | 'avoidIsolated' | 'showZones') => void;
  select: (id: Route['id']) => void;
  hover: (index: number | null) => void;
  reset: () => void;

  run: () => Promise<void>;
  explain: () => Promise<void>;
};

const message = (err: unknown) =>
  err instanceof ApiError ? err.message : 'Something went wrong. Try again.';

export const useApp = create<State>()(
  persist(
    (set, get) => ({
      token: null,
      email: null,
      ready: false,

      from: null,
      to: null,
      pick: 'from',

      night: true,
      avoidUnlit: false,
      avoidIsolated: false,

      plan: null,
      selected: 'safest',
      hovered: null,
      showZones: true,

      explanation: null,
      planning: false,
      explaining: false,

      signIn: async (mode, email, password) => {
        const session = await (mode === 'login' ? api.login(email, password) : api.register(email, password));
        set({ token: session.token, email: session.user.email, ready: true });
      },

      signOut: () => set({ token: null, email: null, plan: null, explanation: null, from: null, to: null }),

      restore: async () => {
        const { token } = get();
        if (!token) {
          set({ ready: true });
          return;
        }
        try {
          const { user } = await api.me(token);
          set({ email: user.email, ready: true });
        } catch {
          set({ token: null, email: null, ready: true });
        }
      },

      setPlace: (which, place) =>
        set({
          [which]: place,
          plan: null,
          explanation: null,
          pick: which === 'from' ? 'to' : 'from',
        } as Partial<State>),

      swap: () => set((s) => ({ from: s.to, to: s.from, plan: null, explanation: null })),

      setPick: (which) => set({ pick: which }),

      toggle: (key) =>
        set((s) => ({
          [key]: !s[key],
          ...(key === 'showZones' ? {} : { plan: null, explanation: null }),
        }) as Partial<State>),

      select: (id) => set({ selected: id, explanation: null }),

      hover: (index) => set({ hovered: index }),

      reset: () => set({ from: null, to: null, plan: null, explanation: null, pick: 'from', hovered: null }),

      run: async () => {
        const { token, from, to, night, avoidUnlit, avoidIsolated } = get();
        if (!token || !from || !to) return;

        set({ planning: true, explanation: null, hovered: null });
        try {
          const body: PlanRequest = { from, to, night, avoidUnlit, avoidIsolated };
          const plan = await api.plan(token, body);
          const safest = plan.routes.find((r) => r.id === 'safest') ?? plan.routes[0];
          set({ plan, selected: safest.id });
          void get().explain();
        } catch (err) {
          toast.error(message(err));
        } finally {
          set({ planning: false });
        }
      },

      explain: async () => {
        const { token, from, to, night, avoidUnlit, avoidIsolated, selected, plan } = get();
        if (!token || !from || !to || !plan) return;

        set({ explaining: true });
        try {
          const result = await api.explain(token, {
            from,
            to,
            night,
            avoidUnlit,
            avoidIsolated,
            selected,
          });
          set({ explanation: result });
        } catch {
          set({ explanation: null });
        } finally {
          set({ explaining: false });
        }
      },
    }),
    {
      name: 'safe-routes',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ token: s.token, email: s.email, night: s.night }),
      onRehydrateStorage: () => () => {
        void useApp.getState().restore();
      },
    },
  ),
);
