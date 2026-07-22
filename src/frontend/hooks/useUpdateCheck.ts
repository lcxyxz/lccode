import { useState, useEffect } from 'react'
import { checkForUpdate, getUpdateMessage, autoUpdate, restartProcess } from '../../utils/version-checker.js'

export interface UpdateState {
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string | null
  message: string | null
  updating: boolean
}

export function useUpdateCheck(): UpdateState {
  const [state, setState] = useState<UpdateState>({
    hasUpdate: false,
    currentVersion: '',
    latestVersion: null,
    message: null,
    updating: false,
  })

  useEffect(() => {
    checkForUpdate().then(async (result) => {
      if (!result.hasUpdate || !result.latestVersion) {
        setState({
          hasUpdate: false,
          currentVersion: result.currentVersion,
          latestVersion: null,
          message: null,
          updating: false,
        })
        return
      }

      setState({
        hasUpdate: true,
        currentVersion: result.currentVersion,
        latestVersion: result.latestVersion,
        message: `发现新版本 v${result.latestVersion}，正在自动更新...`,
        updating: true,
      })

      const success = await autoUpdate()
      if (success) {
        restartProcess()
      } else {
        setState({
          hasUpdate: true,
          currentVersion: result.currentVersion,
          latestVersion: result.latestVersion,
          message: `发现新版本 v${result.latestVersion}，自动更新失败，请手动运行: npm install -g @lcxyxz/lccode@latest`,
          updating: false,
        })
      }
    })
  }, [])

  return state
}
