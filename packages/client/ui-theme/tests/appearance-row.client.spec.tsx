// @vitest-environment jsdom
/** AppearanceRow behavior: selector pill shows the active preference, the
 * menu opens/closes, and selection drives setTheme. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createSnapshotStore, type SessionListState, type WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import { AppearanceRow } from '../src/client/AppearanceRow.tsx'
import type { AppearanceRowComponentProps } from '../src/client/AppearanceRow.tsx'
import { createAppearanceRowStore } from '../src/client/settings-store.ts'
import type { ThemePreference } from '../src/client/index.ts'

afterEach(cleanup)

const COPY: Record<string, string> = {
  'appearance.title': 'Appearance',
  'appearance.light': 'Light',
  'appearance.dark': 'Dark',
  'appearance.system': 'System',
}

/** Empty global standard-kit hooks (the row reads neither). */
function emptySessions() {
  const store = createSnapshotStore<SessionListState>(
    { ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined })
  return bindSnapshotSelector(store)
}
function emptyWorkspaces() {
  const store = createSnapshotStore<WorkspaceListState>({
    items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: undefined,
  })
  return bindSnapshotSelector(store)
}

function mount(preference: ThemePreference = 'system') {
  // Real store instance — the sanctioned zero-machinery path for tests.
  const store = createAppearanceRowStore().create()
  store.actions.sync(preference, 0)
  const setTheme = vi.fn()
  const props: AppearanceRowComponentProps = {
    useSessions: emptySessions(),
    useWorkspaces: emptyWorkspaces(),
    useStore: bindSnapshotSelector(store),
    actions: store.actions,
    t: (key: string) => COPY[key] ?? key,
    setTheme,
  }
  render(<AppearanceRow {...props} />)
  return { store, setTheme }
}

describe('AppearanceRow', () => {
  it('shows the title and the active preference label on the selector pill', () => {
    mount('dark')
    expect(screen.getByText('Appearance')).toBeDefined()
    const trigger = screen.getByRole('button', { name: /Dark/ })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('opens the menu with all three options, selects a preference, and closes', () => {
    const b = mount('dark')
    const trigger = screen.getByRole('button', { name: /Dark/ })
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('menuitem', { name: 'Light' })).toBeDefined()
    expect(screen.getByRole('menuitem', { name: 'Dark' })).toBeDefined()
    expect(screen.getByRole('menuitem', { name: 'System' })).toBeDefined()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Light' }))
    expect(b.setTheme).toHaveBeenCalledWith('light')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('menuitem', { name: 'Light' })).toBeNull()
  })

  it('closes on outside pointerdown without selecting', () => {
    const b = mount('dark')
    fireEvent.click(screen.getByRole('button', { name: /Dark/ }))
    expect(screen.getByRole('menuitem', { name: 'Light' })).toBeDefined()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menuitem', { name: 'Light' })).toBeNull()
    expect(b.setTheme).not.toHaveBeenCalled()
  })

  it('follows store changes; the pill label updates without a click', () => {
    const b = mount('dark')
    act(() => { b.store.actions.sync('light', 1) })
    expect(screen.getByRole('button', { name: /Light/ })).toBeDefined()
  })
})
