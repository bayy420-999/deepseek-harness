/**
 * Appearance preference row registered into the General section item slot
 * (figma 501:30011 'Setting-Cell'): title + selector pill opening the theme
 * menu. Registered by this package — the theme feature owns its own settings
 * surface. Selection follows the persisted preference, never the resolved
 * active theme.
 */
import { useState } from 'react'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import { IconChevronDownOutline14, Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ThemePreference } from '../theme-settings.ts'
import type { ThemeKey } from './locales.ts'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { createAppearanceRowStore } from './settings-store.ts'
import css from './AppearanceRow.module.css'

/** Injected business face: the preference write (t rides the standard locale seat). */
export interface AppearanceRowInjected {
  /** Switch the theme preference. */
  setTheme: (id: ThemePreference) => void
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type AppearanceRowComponentProps =
  PropsRuntime<'settings.general.item'> & PropsStore<ReturnType<typeof createAppearanceRowStore>>
  & PropsLocale<'settings.theme'> & AppearanceRowInjected

/** Option order and copy keys (Light, Dark, System). */
const OPTIONS: readonly { id: ThemePreference; labelKey: ThemeKey }[] = [
  { id: 'light', labelKey: 'appearance.light' },
  { id: 'dark', labelKey: 'appearance.dark' },
  { id: 'system', labelKey: 'appearance.system' },
]

/**
 * Render the Appearance row.
 * @param props - composed slot props.
 * @returns the row element tree.
 */
export function AppearanceRow({ t, setTheme, useStore }: AppearanceRowComponentProps) {
  const preference = useStore(s => s.preference)
  const [open, setOpen] = useState(false)
  // The preference type enumerates exactly OPTIONS' ids, so the lookup always lands.
  const activeLabel = OPTIONS.find(option => option.id === preference)!.labelKey

  return (
    <div className={css.row}>
      <div className={css.rowText}>
        <div className={css.title}>{t('appearance.title')}</div>
      </div>
      <Menu
        open={open}
        onClose={() => { setOpen(false) }}
        items={OPTIONS.map(option => ({ id: option.id, label: t(option.labelKey) }))}
        selectedId={preference}
        onSelect={(id) => {
          setTheme(id as ThemePreference)
          setOpen(false)
        }}
        align="end"
        portal
        anchor={(
          <button
            type="button"
            className={css.selector}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => { setOpen(v => !v) }}
          >
            {t(activeLabel)}
            <IconChevronDownOutline14 className={css.chevron} />
          </button>
        )}
      />
    </div>
  )
}
