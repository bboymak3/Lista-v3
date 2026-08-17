'use client'

import { useAuthStore } from '@/stores/auth-store'

const API_BASE = '/api'

export async function apiFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = useAuthStore.getState().token
  const isFormData = options.body instanceof FormData
  const headers: Record<string, string> = {
    // Solo poner Content-Type JSON si no es FormData
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...((options.headers as Record<string, string>) || {}),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${url}`, { ...options, headers })

  if (res.status === 401) {
    useAuthStore.getState().logout()
    throw new Error('Sesión expirada')
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error((data as any).error || 'Error en la solicitud')
  }

  return data as T
}

export const api = {
  get: <T = any>(url: string) => apiFetch<T>(url, { method: 'GET' }),
  post: <T = any>(url: string, body?: any) =>
    apiFetch<T>(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T = any>(url: string, body?: any) =>
    apiFetch<T>(url, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T = any>(url: string) => apiFetch<T>(url, { method: 'DELETE' }),
  upload: <T = any>(url: string, formData: FormData) =>
    apiFetch<T>(url, { method: 'POST', body: formData, headers: {} as any }),
}
