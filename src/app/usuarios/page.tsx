'use client'

import { useEffect, useState } from 'react'
import { Spinner } from '@/components/Spinner'
import { useToast } from '@/components/Toast'
import { ROLE_LABELS } from '@/types/user'

interface Usuario {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'SUPERVISOR' | 'ODONTOLOGO'
  celular1: string | null
  celular2: string | null
  activo: boolean
  colegiatura: string | null
  especialidad: string | null
  createdAt: string
  sedeId: string | null
  sede: { nombre: string } | null
}

const emptyForm = { name: '', email: '', password: '', role: 'ODONTOLOGO' as Usuario['role'], celular1: '', celular2: '', colegiatura: '', especialidad: '', activo: true, sedeId: '' }

function submitLabel(loading: boolean, editingId: string | null) {
  if (loading) return 'Guardando...'
  if (editingId) return 'Actualizar usuario'
  return 'Crear usuario'
}

export default function UsuariosPage() {
  const toast = useToast()
  const [users, setUsers] = useState<Usuario[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sedes, setSedes] = useState<{ id: string; nombre: string }[]>([])

  const load = async () => {
    const response = await fetch('/api/usuarios')
    if (!response.ok) {
      toast.error('No tienes permisos para administrar usuarios.')
      return
    }
    const data = await response.json()
    setUsers(Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    void load()
    void fetch('/api/sedes').then((r) => r.json()).then((d) => setSedes(Array.isArray(d) ? d : []))
  }, [])

  const saveUser = async () => {
    setLoading(true)

    const response = await fetch('/api/usuarios', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, id: editingId || undefined }),
    })

    const result = await response.json()
    setLoading(false)
    if (!response.ok) {
      toast.error(result.error || 'No se pudo guardar el usuario')
      return
    }

    setUsers((prev) => editingId ? prev.map((item) => item.id === editingId ? result : item) : [result, ...prev])
    setForm(emptyForm)
    setEditingId(null)
    toast.success(editingId ? 'Usuario actualizado' : 'Usuario creado')
  }

  const editUser = (user: Usuario) => {
    setEditingId(user.id)
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      celular1: user.celular1 || '',
      celular2: user.celular2 || '',
      colegiatura: user.colegiatura || '',
      especialidad: user.especialidad || '',
      activo: user.activo,
      sedeId: user.sedeId || '',
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(emptyForm)
  }

  const removeUser = async (id: string) => {
    const response = await fetch(`/api/usuarios?id=${id}`, { method: 'DELETE' })
    if (!response.ok) {
      const data = await response.json().catch(() => null)
      toast.error(data?.error || 'No se pudo eliminar el usuario')
      return
    }
    if (editingId === id) cancelEdit()
    await load()
    toast.success('Usuario eliminado (o desactivado si tiene historial)')
  }

  return (
    <main className="page-shell px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="card-surface">
          <p className="eyebrow">Administración</p>
          <h1 className="mt-3 page-heading text-3xl">Usuarios y roles</h1>
          <p className="mt-2 text-ink-600">Crea y edita accesos para administradores y odontólogos.</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="card-surface space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold text-brand-900">{editingId ? 'Editar usuario' : 'Nuevo usuario'}</h2>
              {editingId && <button type="button" onClick={cancelEdit} className="text-sm text-ink-500">Cancelar</button>}
            </div>
            <input aria-label="Nombre" placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="field" />
            <input aria-label="Correo" type="email" placeholder="Correo" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="field" />
            <input
              aria-label="Contraseña"
              type="password"
              placeholder={editingId ? 'Nueva contraseña (opcional)' : 'Contraseña'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="field"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <input aria-label="Celular 1" placeholder="Celular 1" value={form.celular1} onChange={(e) => setForm({ ...form, celular1: e.target.value })} className="field" />
              <input aria-label="Celular 2" placeholder="Celular 2" value={form.celular2} onChange={(e) => setForm({ ...form, celular2: e.target.value })} className="field" />
            </div>
            <select aria-label="Rol" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Usuario['role'] })} className="field">
              <option value="ODONTOLOGO">Odontólogo / Asistente</option>
              <option value="ADMIN">Recepción</option>
              {form.role === 'SUPERVISOR' && <option value="SUPERVISOR" disabled>Gerente (no se pueden crear más)</option>}
            </select>
            {form.role !== 'SUPERVISOR' && (
              <select aria-label="Sede" value={form.sedeId} onChange={(e) => setForm({ ...form, sedeId: e.target.value })} className="field">
                <option value="">Selecciona la sede del usuario</option>
                {sedes.map((sede) => <option key={sede.id} value={sede.id}>{sede.nombre}</option>)}
              </select>
            )}
            {form.role === 'ODONTOLOGO' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <input aria-label="N.º de colegiatura (COP)" placeholder="N.º de colegiatura (COP)" value={form.colegiatura} onChange={(e) => setForm({ ...form, colegiatura: e.target.value })} className="field" />
                <input aria-label="Especialidad" placeholder="Especialidad (ej. Endodoncista)" value={form.especialidad} onChange={(e) => setForm({ ...form, especialidad: e.target.value })} className="field" />
              </div>
            )}
            {editingId && (
              <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold text-ink-700">
                <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} className="h-4 w-4 accent-brand-600" />
                Acceso activo
              </label>
            )}
            <button type="button" disabled={loading || !form.name || !form.email} onClick={() => void saveUser()} className="btn-brand flex w-full items-center justify-center gap-2 disabled:opacity-60">
              {loading && <Spinner />}
              {submitLabel(loading, editingId)}
            </button>
          </div>
          <div className="card-surface space-y-4">
            <h2 className="text-xl font-semibold text-brand-900">Usuarios registrados</h2>
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between rounded-3xl border border-ink-200 bg-ink-50 p-4">
                <div>
                  <p className="font-semibold text-ink-900">{user.name}</p>
                  <p className="text-sm text-ink-500">{user.email} · {ROLE_LABELS[user.role]}{user.role === 'SUPERVISOR' ? ' · Todas las sedes' : user.sede ? ` · ${user.sede.nombre}` : ''}{user.colegiatura ? ` · COP ${user.colegiatura}` : ''}{user.activo ? '' : ' · Inactivo'}</p>
                  {(user.celular1 || user.celular2) && (
                    <p className="mt-1 text-sm text-ink-500">
                      Cel: {[user.celular1, user.celular2].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-4">
                  <button type="button" onClick={() => editUser(user)} className="text-sm font-semibold text-brand-700">Editar</button>
                  <button type="button" onClick={() => void removeUser(user.id)} className="text-sm text-danger-600">Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
