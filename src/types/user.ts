export type UserRole = 'SUPERVISOR' | 'ADMIN' | 'ODONTOLOGO'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
}

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPERVISOR: 'Gerente',
  ADMIN: 'Recepción',
  ODONTOLOGO: 'Odontólogo',
}
