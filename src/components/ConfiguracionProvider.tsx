'use client'

import { createContext, useContext, useEffect, useState } from 'react'

interface ConfiguracionState {
  usaConsultorios: boolean
  loading: boolean
}

const ConfiguracionContext = createContext<ConfiguracionState>({ usaConsultorios: true, loading: true })

export function ConfiguracionProvider({ children }: { readonly children: React.ReactNode }) {
  const [state, setState] = useState<ConfiguracionState>({ usaConsultorios: true, loading: true })

  useEffect(() => {
    let vigente = true
    fetch('/api/ajustes')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!vigente) return
        setState({ usaConsultorios: data ? Boolean(data.usaConsultorios) : true, loading: false })
      })
      .catch(() => {
        if (vigente) setState((prev) => ({ ...prev, loading: false }))
      })
    return () => {
      vigente = false
    }
  }, [])

  return <ConfiguracionContext.Provider value={state}>{children}</ConfiguracionContext.Provider>
}

export function useConfiguracion() {
  return useContext(ConfiguracionContext)
}
