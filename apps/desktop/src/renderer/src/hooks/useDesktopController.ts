import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createEmptyPeakHold,
  LevelHistoryBuffer,
  resetPeakHold,
  updatePeakHold,
  type PeakHoldSnapshot
} from '../../../shared/calibration'
import { createInitialSidecarStatus, type SidecarStatusSnapshot } from '../../../shared/sidecar-status'
import type { PlaybackMode } from '../../../shared/playback'
import type { TtsVoice } from '../../../shared/tts'
import { DEFAULT_RECORDED_CATEGORY } from '../../../shared/recording'
import type { ToastTone } from './useToasts'

type Notify = (message: string, tone?: ToastTone) => void

export function useDesktopController(notify: Notify) {
  const [status, setStatus] = useState<SidecarStatusSnapshot>(createInitialSidecarStatus)
  const [busy, setBusy] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [progressTick, setProgressTick] = useState(0)
  const [ttsVoices, setTtsVoices] = useState<readonly TtsVoice[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [recordingStartedAtMs, setRecordingStartedAtMs] = useState<number | null>(null)
  const [recordingTick, setRecordingTick] = useState(0)
  const [pendingRecordingDurationMs, setPendingRecordingDurationMs] = useState<number | null>(null)
  const [peakHold, setPeakHold] = useState<PeakHoldSnapshot>(createEmptyPeakHold)
  const [micHistory, setMicHistory] = useState<number[]>([])
  const [playHistory, setPlayHistory] = useState<number[]>([])
  const [outHistory, setOutHistory] = useState<number[]>([])
  const [toneKind, setToneKind] = useState<'sine' | 'pink' | 'white'>('sine')
  const [toneVolume, setToneVolume] = useState(0.4)
  const [statusReady, setStatusReady] = useState(false)

  const micHistoryRef = useRef(new LevelHistoryBuffer())
  const playHistoryRef = useRef(new LevelHistoryBuffer())
  const outHistoryRef = useRef(new LevelHistoryBuffer())

  const reportError = useCallback(
    (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      notify(message, 'error')
    },
    [notify]
  )

  const refreshStatus = useCallback(async () => {
    const next = await window.api.sidecar.getStatus()
    setStatus(next)
    return next
  }, [])

  useEffect(() => {
    let active = true

    void window.api.sidecar.getStatus().then((snapshot) => {
      if (active) {
        setStatus(snapshot)
        setStatusReady(true)
      }
    })

    const unsubscribe = window.api.sidecar.onStatusChanged((snapshot) => {
      setStatus(snapshot)
      setStatusReady(true)
      const peaks = {
        microphone: snapshot.microphonePeak,
        playback: snapshot.playbackPeak,
        output: snapshot.outputPeak
      }
      setPeakHold((previous) =>
        updatePeakHold(previous, peaks, snapshot.calibrationPeakHoldEnabled)
      )
      if (snapshot.calibrationHistoryEnabled) {
        micHistoryRef.current.push(snapshot.microphonePeak)
        playHistoryRef.current.push(snapshot.playbackPeak)
        outHistoryRef.current.push(snapshot.outputPeak)
        setMicHistory(micHistoryRef.current.toArray())
        setPlayHistory(playHistoryRef.current.toArray())
        setOutHistory(outHistoryRef.current.toArray())
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    setCategoryFilter(status.categoryFilter)
  }, [status.categoryFilter])

  useEffect(() => {
    if (status.connectionState !== 'connected') {
      return
    }

    let active = true
    void window.api.tts
      .listVoices()
      .then((voices) => {
        if (active) {
          setTtsVoices(voices)
        }
      })
      .catch((error: unknown) => {
        if (active) {
          reportError(error)
        }
      })

    return () => {
      active = false
    }
  }, [status.connectionState, reportError])

  useEffect(() => {
    if (!isRecording || recordingStartedAtMs == null) {
      return
    }
    const id = window.setInterval(() => setRecordingTick((value) => value + 1), 200)
    return () => window.clearInterval(id)
  }, [isRecording, recordingStartedAtMs])

  useEffect(() => {
    if (status.playbackState !== 'playing' || status.playbackStartedAtMs == null) {
      return
    }
    const id = window.setInterval(() => setProgressTick((value) => value + 1), 250)
    return () => window.clearInterval(id)
  }, [status.playbackState, status.playbackStartedAtMs])

  const progressPercent = (() => {
    void progressTick
    if (
      status.playbackState !== 'playing' ||
      status.playbackStartedAtMs == null ||
      status.playbackDurationMs == null ||
      status.playbackDurationMs <= 0
    ) {
      return 0
    }
    const elapsed = Date.now() - status.playbackStartedAtMs
    return Math.min(100, Math.max(0, Math.round((elapsed / status.playbackDurationMs) * 100)))
  })()

  const recordingElapsedLabel = (() => {
    void recordingTick
    if (!isRecording || recordingStartedAtMs == null) {
      return pendingRecordingDurationMs == null
        ? '0.0 s'
        : `${(pendingRecordingDurationMs / 1000).toFixed(1)} s`
    }
    const elapsedMs = Math.max(0, Date.now() - recordingStartedAtMs)
    return `${(elapsedMs / 1000).toFixed(1)} s`
  })()

  async function runBusy<T>(action: () => Promise<T>, successMessage?: string): Promise<T | undefined> {
    setBusy(true)
    try {
      const result = await action()
      if (successMessage) {
        notify(successMessage, 'success')
      }
      return result
    } catch (error) {
      reportError(error)
      return undefined
    } finally {
      setBusy(false)
    }
  }

  const actions = {
    async importWavs(): Promise<void> {
      await runBusy(async () => {
        const result = await window.api.phrases.importWavs()
        if (result.errors.length > 0) {
          const summary = result.errors
            .map((entry) => `${entry.path}: ${entry.message}`)
            .join('; ')
          notify(
            result.imported.length > 0
              ? `Imported ${result.imported.length}; failed: ${summary}`
              : `Import failed: ${summary}`,
            result.imported.length > 0 ? 'info' : 'error'
          )
        } else if (result.imported.length > 0) {
          notify(`Imported ${result.imported.length} phrase${result.imported.length === 1 ? '' : 's'}`, 'success')
        }
        await refreshStatus()
      })
    },

    async playPhrase(phraseId: string): Promise<void> {
      await runBusy(async () => {
        setStatus(await window.api.phrases.play(phraseId, 1))
      })
    },

    async stopPlayback(): Promise<void> {
      await runBusy(async () => {
        setStatus(await window.api.sidecar.stopPlayback())
      })
    },

    async rename(phraseId: string, name: string): Promise<void> {
      try {
        await window.api.phrases.rename(phraseId, name)
        await refreshStatus()
        notify('Phrase renamed', 'success')
      } catch (error) {
        reportError(error)
      }
    },

    async setCategory(phraseId: string, category: string | null): Promise<void> {
      try {
        await window.api.phrases.setCategory(phraseId, category)
        await refreshStatus()
        notify('Category updated', 'success')
      } catch (error) {
        reportError(error)
      }
    },

    async toggleEnabled(phraseId: string, enabled: boolean): Promise<void> {
      try {
        await window.api.phrases.setEnabled(phraseId, !enabled)
        await refreshStatus()
      } catch (error) {
        reportError(error)
      }
    },

    async remove(phraseId: string): Promise<void> {
      try {
        await window.api.phrases.remove(phraseId)
        await refreshStatus()
        notify('Phrase removed', 'success')
      } catch (error) {
        reportError(error)
      }
    },

    async reorder(phraseId: string, direction: 'up' | 'down'): Promise<void> {
      try {
        await window.api.phrases.reorder(phraseId, direction)
        await refreshStatus()
      } catch (error) {
        reportError(error)
      }
    },

    async reorderToIndex(phraseId: string, targetIndex: number): Promise<void> {
      try {
        const ordered = [...status.phrases].sort((a, b) => a.sortIndex - b.sortIndex)
        const currentIndex = ordered.findIndex((phrase) => phrase.id === phraseId)
        if (currentIndex < 0 || targetIndex < 0 || targetIndex >= ordered.length || currentIndex === targetIndex) {
          return
        }
        const direction = targetIndex < currentIndex ? 'up' : 'down'
        const steps = Math.abs(targetIndex - currentIndex)
        for (let step = 0; step < steps; step += 1) {
          await window.api.phrases.reorder(phraseId, direction)
        }
        await refreshStatus()
      } catch (error) {
        reportError(error)
      }
    },

    async setShortcut(phraseId: string, shortcut: string | null): Promise<void> {
      try {
        await window.api.phrases.setShortcut(phraseId, shortcut)
        await refreshStatus()
      } catch (error) {
        reportError(error)
        throw error
      }
    },

    async setPlaybackMode(mode: PlaybackMode): Promise<void> {
      try {
        setStatus(await window.api.playback.setMode(mode))
      } catch (error) {
        reportError(error)
      }
    },

    async clearQueue(): Promise<void> {
      try {
        setStatus(await window.api.playback.clearQueue())
      } catch (error) {
        reportError(error)
      }
    },

    async removeQueued(phraseId: string): Promise<void> {
      try {
        setStatus(await window.api.playback.removeQueued(phraseId))
      } catch (error) {
        reportError(error)
      }
    },

    async skip(): Promise<void> {
      await runBusy(async () => {
        setStatus(await window.api.playback.skip())
      })
    },

    async setCategoryFilter(value: string): Promise<void> {
      setCategoryFilter(value)
      try {
        await window.api.settings.setCategoryFilter(value)
      } catch (error) {
        reportError(error)
      }
    },

    async exportSettings(): Promise<void> {
      try {
        const exported = await window.api.settings.exportFile()
        if (exported) {
          notify('Settings exported', 'success')
        }
      } catch (error) {
        reportError(error)
      }
    },

    async importSettings(): Promise<void> {
      await runBusy(async () => {
        await window.api.settings.importFile()
        await refreshStatus()
        notify('Settings imported', 'success')
      })
    },

    async resetSettings(): Promise<void> {
      await runBusy(async () => {
        await window.api.settings.reset()
        await refreshStatus()
        notify('Project reset to defaults', 'success')
      })
    },

    async previewTts(request: {
      text: string
      voiceId: string | null
      rate: number
      volume: number
    }): Promise<void> {
      await runBusy(async () => {
        setStatus(await window.api.tts.preview(request))
      })
    },

    async createTtsPhrase(request: {
      name: string
      text: string
      voiceId: string | null
      rate: number
      volume: number
    }): Promise<void> {
      await runBusy(async () => {
        await window.api.tts.create(request)
        await refreshStatus()
        notify('Phrase generated', 'success')
      }, undefined)
    },

    async startRecording(): Promise<void> {
      await runBusy(async () => {
        const started = await window.api.recording.start()
        setIsRecording(true)
        setRecordingStartedAtMs(started.startedAtMs)
        setPendingRecordingDurationMs(null)
        await refreshStatus()
      })
    },

    async stopRecording(): Promise<void> {
      await runBusy(async () => {
        try {
          const pending = await window.api.recording.stop()
          setIsRecording(false)
          setRecordingStartedAtMs(null)
          setPendingRecordingDurationMs(pending.durationMs)
          await refreshStatus()
        } catch (error) {
          setIsRecording(false)
          setRecordingStartedAtMs(null)
          setPendingRecordingDurationMs(null)
          await refreshStatus()
          throw error
        }
      })
    },

    async cancelRecording(): Promise<void> {
      await runBusy(async () => {
        await window.api.recording.cancel()
        setIsRecording(false)
        setRecordingStartedAtMs(null)
        setPendingRecordingDurationMs(null)
        await refreshStatus()
      })
    },

    async saveRecording(name: string, category: string): Promise<void> {
      await runBusy(async () => {
        await window.api.recording.save({ name, category })
        setPendingRecordingDurationMs(null)
        await refreshStatus()
        notify('Recording saved', 'success')
      })
    },

    async discardRecording(): Promise<void> {
      await runBusy(async () => {
        await window.api.recording.discard()
        setPendingRecordingDurationMs(null)
        await refreshStatus()
      })
    },

    async refreshOutputs(): Promise<void> {
      await runBusy(async () => {
        setStatus(await window.api.sidecar.getAudioOutputDevices())
      })
    },

    async selectOutput(deviceId: string): Promise<void> {
      await runBusy(async () => {
        setStatus(await window.api.sidecar.setOutputDevice(deviceId))
      })
    },

    async refreshInputs(): Promise<void> {
      await runBusy(async () => {
        setStatus(await window.api.sidecar.getAudioInputDevices())
      })
    },

    async selectMicrophone(deviceId: string): Promise<void> {
      await runBusy(async () => {
        setStatus(await window.api.sidecar.setMicrophone(deviceId))
      })
    },

    async startMic(): Promise<void> {
      await runBusy(async () => {
        setStatus(await window.api.sidecar.startMicrophone())
      })
    },

    async stopMic(): Promise<void> {
      await runBusy(async () => {
        setStatus(await window.api.sidecar.stopMicrophone())
      })
    },

    async setMicGain(value: number): Promise<void> {
      try {
        setStatus(
          await window.api.sidecar.setMixerGains(value, status.playbackGain, status.masterGain)
        )
      } catch (error) {
        reportError(error)
      }
    },

    async setPlaybackGain(value: number): Promise<void> {
      try {
        setStatus(
          await window.api.sidecar.setMixerGains(status.microphoneGain, value, status.masterGain)
        )
      } catch (error) {
        reportError(error)
      }
    },

    async setMasterGain(value: number): Promise<void> {
      try {
        setStatus(
          await window.api.sidecar.setMixerGains(status.microphoneGain, status.playbackGain, value)
        )
      } catch (error) {
        reportError(error)
      }
    },

    async playTestTone(): Promise<void> {
      await runBusy(async () => {
        setStatus(
          await window.api.sidecar.playTestTone({
            kind: toneKind,
            volume: toneVolume,
            durationMs: 2000,
            ...(toneKind === 'sine' ? { frequencyHz: 440 } : {})
          })
        )
      })
    },

    async stopTone(): Promise<void> {
      await runBusy(async () => {
        setStatus(await window.api.sidecar.stopPlayback())
      })
    },

    async setCalibration(
      patch: Partial<{
        showRms: boolean
        peakHoldEnabled: boolean
        historyEnabled: boolean
      }>
    ): Promise<void> {
      try {
        await window.api.settings.setCalibration({
          showRms: patch.showRms ?? status.calibrationShowRms,
          peakHoldEnabled: patch.peakHoldEnabled ?? status.calibrationPeakHoldEnabled,
          historyEnabled: patch.historyEnabled ?? status.calibrationHistoryEnabled
        })
        if (patch.historyEnabled === false) {
          micHistoryRef.current.clear()
          playHistoryRef.current.clear()
          outHistoryRef.current.clear()
          setMicHistory([])
          setPlayHistory([])
          setOutHistory([])
        }
        if (patch.peakHoldEnabled === false) {
          setPeakHold(
            resetPeakHold({
              microphone: status.microphonePeak,
              playback: status.playbackPeak,
              output: status.outputPeak
            })
          )
        }
      } catch (error) {
        reportError(error)
      }
    },

    resetPeakHold(): void {
      setPeakHold(
        resetPeakHold({
          microphone: status.microphonePeak,
          playback: status.playbackPeak,
          output: status.outputPeak
        })
      )
    }
  }

  return {
    apiVersion: window.api.version,
    status,
    statusReady,
    busy,
    categoryFilter,
    progressPercent,
    recordingElapsedLabel,
    isRecording,
    pendingRecordingDurationMs,
    recordingDefaultCategory: DEFAULT_RECORDED_CATEGORY,
    ttsVoices,
    peakHold,
    micHistory,
    playHistory,
    outHistory,
    toneKind,
    toneVolume,
    setToneKind,
    setToneVolume,
    connected: status.connectionState === 'connected',
    actions
  }
}

export type DesktopController = ReturnType<typeof useDesktopController>
