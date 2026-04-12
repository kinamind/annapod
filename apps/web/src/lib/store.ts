/* annapod - Auth Store (Zustand) */

import { create } from "zustand";
import type { RegisterRequest, User } from "./types";
import { auth } from "./api";

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  login: (username: string, password: string) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  setToken: (token: string) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token:
    typeof window !== "undefined"
      ? localStorage.getItem("annapod_token")
      : null,
  isLoading: false,
  isAuthenticated: false,

  setToken: (token: string) => {
      localStorage.setItem("annapod_token", token);
    set({ token });
  },

  login: async (username, password) => {
    set({ isLoading: true });
    try {
      const tokenRes = await auth.login(username, password);
      localStorage.setItem("annapod_token", tokenRes.access_token);
      set({ token: tokenRes.access_token });
      const user = await auth.me();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  register: async (data) => {
    set({ isLoading: true });
    try {
      const tokenRes = await auth.register(data);
      localStorage.setItem("annapod_token", tokenRes.access_token);
      set({ token: tokenRes.access_token });
      const user = await auth.me();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem("annapod_token");
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadUser: async () => {
    const token = get().token;
    if (!token) return;
    set({ isLoading: true });
    try {
      const user = await auth.me();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem("annapod_token");
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
