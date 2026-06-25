// src/utils/auth.ts
import api, { setAuthToken } from "./api";

const TOKEN_KEY = 'community_token';
const USER_KEY = 'community_user';

export function saveAuth(token: string, user: any) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  setAuthToken(token);
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  setAuthToken(undefined);
}

export function loadAuth() {
  const token = localStorage.getItem(TOKEN_KEY);
  const user = localStorage.getItem(USER_KEY);
  if (token) setAuthToken(token);
  return {
    token,
    user: user ? JSON.parse(user) : null,
  };
}

export async function fetchMe() {
  try {
    const res = await api.get('/users/me');
    return res.data.user;
  } catch (err) {
    console.error('fetchMe error', err);
    return null;
  }
}
