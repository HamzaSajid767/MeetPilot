import { describe, expect, it } from 'vitest'
import {
  deriveVirtualRoutingFields,
  type AudioOutputDeviceSnapshot
} from '../src/shared/sidecar-status'

function device(
  partial: Partial<AudioOutputDeviceSnapshot> & Pick<AudioOutputDeviceSnapshot, 'id'>
): AudioOutputDeviceSnapshot {
  return {
    friendlyName: partial.friendlyName ?? partial.id,
    isDefault: partial.isDefault ?? false,
    deviceState: partial.deviceState ?? 'Active',
    supportsPlayback: partial.supportsPlayback ?? true,
    isVirtualDevice: partial.isVirtualDevice ?? false,
    ...partial
  }
}

describe('deriveVirtualRoutingFields', () => {
  it('reports no_virtual_device when none are present', () => {
    const fields = deriveVirtualRoutingFields(
      [device({ id: 'speakers', isVirtualDevice: false })],
      null
    )
    expect(fields.hasVirtualOutputDevice).toBe(false)
    expect(fields.virtualRoutingStatus).toBe('no_virtual_device')
  })

  it('reports virtual_available when virtual exists but nothing selected', () => {
    const fields = deriveVirtualRoutingFields(
      [device({ id: 'cable', isVirtualDevice: true })],
      null
    )
    expect(fields.hasVirtualOutputDevice).toBe(true)
    expect(fields.virtualRoutingStatus).toBe('virtual_available')
  })

  it('reports virtual_selected when selected device is virtual', () => {
    const fields = deriveVirtualRoutingFields(
      [
        device({ id: 'speakers', isVirtualDevice: false }),
        device({ id: 'cable', isVirtualDevice: true })
      ],
      'cable'
    )
    expect(fields.selectedIsVirtual).toBe(true)
    expect(fields.virtualRoutingStatus).toBe('virtual_selected')
  })

  it('reports physical_selected when a non-virtual device is selected', () => {
    const fields = deriveVirtualRoutingFields(
      [
        device({ id: 'speakers', isVirtualDevice: false }),
        device({ id: 'cable', isVirtualDevice: true })
      ],
      'speakers'
    )
    expect(fields.selectedIsVirtual).toBe(false)
    expect(fields.virtualRoutingStatus).toBe('physical_selected')
  })
})
