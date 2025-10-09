import axios, { type InternalAxiosRequestConfig } from 'axios'

import { BACKUP_API_URL, GRAPHITI_API_URL } from '@/constants/env'
import { getAuthorizationHeader, useAuthStore } from '@/store/authStore'

export const graphitiClient = axios.create({
  baseURL: GRAPHITI_API_URL,
  timeout: 15_000,
})

export const backupClient = axios.create({
  baseURL: BACKUP_API_URL,
  timeout: 15_000,
})

const attachAuthHeader = (config: InternalAxiosRequestConfig) => {
  const header = getAuthorizationHeader()
  if (header) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = header
  }
  return config
}

graphitiClient.interceptors.request.use(attachAuthHeader)
backupClient.interceptors.request.use(attachAuthHeader)

const handleError = (label: string) => (error: any) => {
  console.error(`${label} error`, error)
  if (error?.response?.status === 401) {
    useAuthStore.getState().clearAuth()
  }
  return Promise.reject(error)
}

graphitiClient.interceptors.response.use((response) => response, handleError('GraphiTi API'))

backupClient.interceptors.response.use((response) => response, handleError('Backup API'))
