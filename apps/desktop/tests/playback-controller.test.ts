import { describe, expect, it } from 'vitest'
import { PlaybackController } from '../src/main/playback-controller'
import type { PlayRequestPhrase } from '../src/shared/playback'

function phrase(id: string, name = id): PlayRequestPhrase {
  return { id, name, filePath: `C:\\phrases\\${id}.wav` }
}

describe('PlaybackController', () => {
  it('starts while idle in any mode', () => {
    for (const mode of ['interrupt', 'queue', 'ignore'] as const) {
      const controller = new PlaybackController()
      controller.setMode(mode)
      const result = controller.requestPlay(phrase('a'), 0.5)
      expect(result.outcome).toBe('started')
      expect(controller.getSnapshot().isBusy).toBe(true)
      expect(controller.getSnapshot().activePhraseId).toBe('a')
    }
  })

  it('interrupt starts a replacement while busy and ignores interrupted completion', () => {
    const controller = new PlaybackController()
    expect(controller.requestPlay(phrase('a')).outcome).toBe('started')
    controller.markStarted('pb-a')

    const replace = controller.requestPlay(phrase('b'), 0.8)
    expect(replace.outcome).toBe('started')
    expect(controller.getSnapshot().activePhraseId).toBe('b')
    expect(controller.getSnapshot().queueLength).toBe(0)

    // Interrupted clip's PlaybackCompleted must not dequeue / clear busy.
    expect(controller.onPlaybackEnded('pb-a')).toBeNull()
    expect(controller.getSnapshot().isBusy).toBe(true)
    expect(controller.getSnapshot().activePhraseId).toBe('b')

    controller.onPlaybackStarted('pb-b', 'b')
    expect(controller.onPlaybackEnded('pb-b')).toBeNull()
    expect(controller.getSnapshot().isBusy).toBe(false)
  })

  it('queue appends FIFO and advances on completion', () => {
    const controller = new PlaybackController()
    controller.setMode('queue')

    expect(controller.requestPlay(phrase('a', 'Alpha')).outcome).toBe('started')
    controller.markStarted('pb-a')

    expect(controller.requestPlay(phrase('b', 'Beta'), 0.3).outcome).toBe('queued')
    expect(controller.requestPlay(phrase('c', 'Gamma'), 0.7).outcome).toBe('queued')

    const snap = controller.getSnapshot()
    expect(snap.queueLength).toBe(2)
    expect(snap.nextPhraseId).toBe('b')
    expect(snap.queue.map((q) => q.phraseId)).toEqual(['b', 'c'])

    const next = controller.onPlaybackEnded('pb-a')
    expect(next).toEqual({
      outcome: 'started',
      phrase: { id: 'b', name: 'Beta', filePath: 'C:\\phrases\\b.wav' },
      volume: 0.3
    })
    expect(controller.getSnapshot().queueLength).toBe(1)
    expect(controller.getSnapshot().nextPhraseId).toBe('c')
    expect(controller.getSnapshot().activePhraseId).toBe('b')

    controller.markStarted('pb-b')
    const last = controller.onPlaybackEnded('pb-b')
    expect(last?.phrase.id).toBe('c')
    expect(last?.volume).toBe(0.7)

    controller.markStarted('pb-c')
    expect(controller.onPlaybackEnded('pb-c')).toBeNull()
    expect(controller.getSnapshot().isBusy).toBe(false)
    expect(controller.getSnapshot().queueLength).toBe(0)
  })

  it('ignore returns busy while playing and leaves queue untouched', () => {
    const controller = new PlaybackController()
    controller.setMode('ignore')
    expect(controller.requestPlay(phrase('a')).outcome).toBe('started')
    controller.markStarted('pb-a')

    const busy = controller.requestPlay(phrase('b'))
    expect(busy.outcome).toBe('busy')
    expect(controller.getSnapshot().queueLength).toBe(0)
    expect(controller.getSnapshot().activePhraseId).toBe('a')
  })

  it('remove and clear queue', () => {
    const controller = new PlaybackController()
    controller.setMode('queue')
    controller.requestPlay(phrase('a'))
    controller.markStarted('pb-a')
    controller.requestPlay(phrase('b'))
    controller.requestPlay(phrase('c'))
    controller.requestPlay(phrase('d'))

    expect(controller.removeFromQueue('c')).toBe(true)
    expect(controller.getSnapshot().queue.map((q) => q.phraseId)).toEqual(['b', 'd'])

    expect(controller.removeFromQueueAt(0)).toBe(true)
    expect(controller.getSnapshot().nextPhraseId).toBe('d')

    controller.clearQueue()
    expect(controller.getSnapshot().queueLength).toBe(0)
    expect(controller.getSnapshot().isBusy).toBe(true)
  })

  it('skip returns next queued item without clearing the rest', () => {
    const controller = new PlaybackController()
    controller.setMode('queue')
    controller.requestPlay(phrase('a'))
    controller.markStarted('pb-a')
    controller.requestPlay(phrase('b'))
    controller.requestPlay(phrase('c'))

    const next = controller.beginSkip()
    expect(next?.phrase.id).toBe('b')
    expect(controller.getSnapshot().queue.map((q) => q.phraseId)).toEqual(['c'])
    expect(controller.getSnapshot().activePhraseId).toBe('b')
  })

  it('user stop clears queue and active state', () => {
    const controller = new PlaybackController()
    controller.setMode('queue')
    controller.requestPlay(phrase('a'))
    controller.markStarted('pb-a')
    controller.requestPlay(phrase('b'))

    controller.onUserStop()
    expect(controller.getSnapshot().isBusy).toBe(false)
    expect(controller.getSnapshot().queueLength).toBe(0)
    expect(controller.getSnapshot().activePhraseId).toBeNull()
  })

  it('leaving queue mode clears the queue but keeps busy clip', () => {
    const controller = new PlaybackController()
    controller.setMode('queue')
    controller.requestPlay(phrase('a'))
    controller.markStarted('pb-a')
    controller.requestPlay(phrase('b'))

    controller.setMode('interrupt')
    expect(controller.getSnapshot().queueLength).toBe(0)
    expect(controller.getSnapshot().isBusy).toBe(true)
    expect(controller.getSnapshot().activePhraseId).toBe('a')
    expect(controller.getMode()).toBe('interrupt')
  })

  it('ignores completion for a mismatched playback id', () => {
    const controller = new PlaybackController()
    controller.requestPlay(phrase('a'))
    controller.markStarted('pb-a')

    expect(controller.onPlaybackEnded('pb-other')).toBeNull()
    expect(controller.getSnapshot().isBusy).toBe(true)
  })

  it('clamps volume on requestPlay', () => {
    const controller = new PlaybackController()
    expect(controller.requestPlay(phrase('a'), 2).volume).toBe(1)
    controller.onUserStop()
    expect(controller.requestPlay(phrase('b'), -1).volume).toBe(0)
  })
})
