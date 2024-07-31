import { ipcMain } from 'electron'
import { mihomoVersion } from './mihomo-api'
import { checkAutoRun, disableAutoRun, enableAutoRun } from './autoRun'
import {
  getAppConfig,
  setAppConfig,
  getControledMihomoConfig,
  setControledMihomoConfig
} from './config'

export function registerIpcMainHandlers(): void {
  ipcMain.handle('mihomoVersion', mihomoVersion)
  ipcMain.handle('checkAutoRun', checkAutoRun)
  ipcMain.handle('enableAutoRun', enableAutoRun)
  ipcMain.handle('disableAutoRun', disableAutoRun)
  ipcMain.handle('getAppConfig', (_e, force) => getAppConfig(force))
  ipcMain.handle('setAppConfig', (_e, config) => {
    setAppConfig(config)
  })
  ipcMain.handle('getControledMihomoConfig', (_e, force) => getControledMihomoConfig(force))
  ipcMain.handle('setControledMihomoConfig', (_e, config) => {
    setControledMihomoConfig(config)
  })
}