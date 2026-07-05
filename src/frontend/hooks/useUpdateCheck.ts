import { useState, useEffect } from 'react'
import { checkForUpdate, getUpdateMessage } from '../../utils/version-checker.js'

export interface UpdateState {
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string | null
  message: string | null
}

export function useUpdateCheck(): UpdateState {
  const [state, setState] = useState<UpdateState>({
    hasUpdate: false,
    currentVersion: '',
    latestVersion: null,
    message: null,
  })

  useEffect(() => {
    checkForUpdate().then((result) => {
      setState({
        hasUpdate: result.hasUpdate,
        currentVersion: result.currentVersion,
        latestVersion: result.latestVersion,
        message: getUpdateMessage(result),
      })
    })
  }, [])

  return state
}
