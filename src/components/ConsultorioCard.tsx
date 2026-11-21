import { PacienteHistorialLink } from '@/components/PacienteHistorialLink'
import type { AtencionDetalle } from '@/components/AtencionEnCursoPanel'

export type ConsultorioEstado = 'DISPONIBLE' | 'ATENCION' | 'LIMPIEZA' | 'MANTENIMIENTO'

export type AtencionActual = AtencionDetalle

interface ConsultorioCardProps {
  nombre: string
  estado: ConsultorioEstado
  atencionActual?: AtencionActual | null
  onClick?: () => void
}

const estadoStyles: Record<ConsultorioEstado, string> = {
  DISPONIBLE: 'border-brand-100 bg-brand-50 text-brand-900',
  ATENCION: 'border-amber-100 bg-amber-50 text-amber-900',
  LIMPIEZA: 'border-ink-200 bg-ink-100 text-ink-700',
  MANTENIMIENTO: 'border-danger-100 bg-danger-50 text-danger-900',
}

const estadoLabels: Record<ConsultorioEstado, string> = {
  DISPONIBLE: 'Disponible',
  ATENCION: 'En atención',
  LIMPIEZA: 'Limpieza',
  MANTENIMIENTO: 'Mantenimiento',
}

function tratamientoActual(atencion: AtencionActual) {
  return (
    atencion.tratamientos.find((t) => t.estado === 'EN_CURSO') ??
    atencion.tratamientos.find((t) => t.estado === 'PENDIENTE') ??
    null
  )
}

export function ConsultorioCard({ nombre, estado, atencionActual, onClick }: ConsultorioCardProps) {
  const linea = atencionActual ? tratamientoActual(atencionActual) : null

  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (event) => { if (event.key === 'Enter' || event.key === ' ') onClick() } : undefined}
      className={`rounded-[28px] border p-5 ${estadoStyles[estado]} shadow-sm ${onClick ? 'cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md' : ''}`}
    >
      <p className="text-sm font-bold opacity-75">{nombre}</p>
      <p className="page-heading mt-2 text-2xl">{estadoLabels[estado]}</p>
      {atencionActual && (
        <div className="mt-3 space-y-1 text-sm">
          <p className="text-ink-700">
            <PacienteHistorialLink pacienteId={atencionActual.paciente.id} nombre={atencionActual.paciente.nombre} stopPropagation className="font-semibold underline decoration-dotted underline-offset-2 hover:text-brand-700" />
            {linea ? <> · {linea.tratamiento.nombre}</> : null}
          </p>
          {linea && <p className="text-ink-500">Odontólogo: {linea.odontologo.name}</p>}
          <p className="text-ink-500">Desde {new Date(atencionActual.horaInicio).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      )}
    </div>
  )
}
