import { api } from './client';
import type { User, UserCreate, UserUpdate, UserListResponse } from './types';

export async function listUsers(params?: {
  role?: string;
  is_active?: boolean;
}): Promise<UserListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.role) searchParams.set('role', params.role);
  if (params?.is_active !== undefined) searchParams.set('is_active', String(params.is_active));
  return api.get('users', { searchParams }).json();
}

export async function getUser(id: string): Promise<User> {
  return api.get(`users/${id}`).json();
}

export async function createUser(data: UserCreate): Promise<User> {
  return api.post('users', { json: data }).json();
}

export async function updateUser(id: string, data: UserUpdate): Promise<User> {
  return api.put(`users/${id}`, { json: data }).json();
}

export async function deleteUser(id: string): Promise<User> {
  return api.delete(`users/${id}`).json();
}

export async function reactivateUser(id: string): Promise<User> {
  return api.put(`users/${id}/reactivate`).json();
}
