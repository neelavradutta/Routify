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
  mapDark: boolean;
  avoidUnlit: boolean;
  avoidIsolated: boolean;

  plan: Plan | null;
  selected: Route['id'];
  hovered: number | null;

  explanation: { text: string; source: 'ai' | 'rules' } | null;
  planning: boolean;
  explaining: boolean;

  signIn: (mode: 'login' | 'register', email: string, password: string, fullName?: string) => Promise<void>;
  prepareSession: (
    mode: 'login' | 'register',
    email: string,
    password: string,
    fullName?: string,
  ) => Promise<{ token: string; user: { id: number; email: string } }>;
  commitSession: (session: { token: string; user: { email: string } }) => void;
  signOut: () => void;
  restore: () => Promise<void>;

  setPlace: (which: Endpoint, place: Place | null) => void;
  swap: () => void;
  setPick: (which: Endpoint) => void;
  toggle: (key: 'night' | 'avoidUnlit' | 'avoidIsolated') => void;
  toggleMap: () => void;
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
      mapDark: false,
      avoidUnlit: false,
      avoidIsolated: false,

      plan: null,
      selected: 'safest',
      hovered: null,

      explanation: null,
      planning: false,
      explaining: false,

      signIn: async (mode, email, password, fullName) => {
        const session = await get().prepareSession(mode, email, password, fullName);
        get().commitSession(session);
      },

      prepareSession: async (mode, email, password, fullName) => {
        return mode === 'login' ? api.login(email, password) : api.register(email, password, fullName ?? '');
      },

      commitSession: (session) => {
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

      toggle: (key) => set((s) => ({ [key]: !s[key] }) as Partial<State>),

      toggleMap: () => set((s) => ({ mapDark: !s.mapDark })),

      select: (id) => {
        const { plan, selected } = get();
        if (!id || id === selected) return;
        if (plan && !plan.routes.some((route) => route.id === id)) return;
        set({ selected: id, explanation: null });
      },

      hover: (index) => set({ hovered: index }),

      reset: () => set({ from: null, to: null, plan: null, explanation: null, pick: 'from', hovered: null }),

      run: async () => {
        const { token, from, to, night, avoidUnlit, avoidIsolated } = get();
        if (!token || !from || !to) return;

        set({ planning: true, hovered: null });
        try {
          const body: PlanRequest = { from, to, night, avoidUnlit, avoidIsolated };
          const plan = await api.plan(token, body);
          const safest = plan.routes.find((r) => r.id === 'safest') ?? plan.routes[0];
          const keep = get().selected;
          const selected = plan.routes.some((r) => r.id === keep) ? keep : (safest?.id ?? 'safest');
          set({ plan, selected });
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
      partialize: (s) => ({ token: s.token, email: s.email, night: s.night, mapDark: s.mapDark }),
      onRehydrateStorage: () => () => {
        void useApp.getState().restore();
      },
    },
  ),
);
