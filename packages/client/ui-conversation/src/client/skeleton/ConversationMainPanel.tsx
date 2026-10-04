import { useEffect } from 'react'
import type { ConversationSlotProps } from '../contract/slots.ts'
import { conversationPhase } from '../contract/snapshot.ts'
import { ConversationWidthControls } from './ConversationWidthControls.tsx'
import css from './ConversationRoot.module.css'

/**
 * Render the existing main Conversation frame around the extracted content.
 * @param props - the original `main.conversation` Slot props.
 * @returns the unchanged root, Header, content, and width-control subtree.
 */
export function ConversationMainPanel(props: ConversationSlotProps) {
  const { sessionId, useSession, useSessions, useConversation, renderSlot, renderFactorySlot } = props
  const session = useSession(s => s)
  const conversation = useConversation(s => s)
  const shellPhase = session === undefined || conversation === undefined
    ? 'blank'
    : conversationPhase(session, conversation)
  const openState = session?.openState
  const summaryBlank = useSessions(s => sessionId === undefined ? undefined : s.byId[sessionId]?.blank)

  // While a session is still replaying (loading + blank) the hero/docked
  // choice is unknowable — render the composer hidden instead of flashing
  // the centered hero and snapping to the docked bar (or vice versa).
  // Exemption: a session the list summary already proves blank can only
  // land on the hero, so hiding would blank the column for the whole
  // history round-trip (the startup auto-selection flash) for nothing.
  // The exemption is deliberately open-state-wide, not loading-only: a
  // summary-blank session is the hero before its open starts (`cold`) and
  // after one fails (`error`) for the same reason — there is no history.
  // A restored continuable subagent waits for a Host summary to establish
  // parent availability. This keeps the composer
  // hidden instead of briefly rendering the parent-offline takeover.
  const parentAvailabilityPending = session?.subagent?.address.mode === 'continuable'
    && session.subagent.parentAvailable === undefined
  const settling = sessionId !== undefined && (
    (shellPhase === 'blank' && openState === 'loading' && summaryBlank !== true)
    || parentAvailabilityPending
  )
  const hero = sessionId === undefined
    || (shellPhase === 'blank' && (openState === 'open' || summaryBlank === true))
  const phase = settling ? 'settling' : hero ? 'hero' : 'active'

  // Keyboard avoidance on shells whose WebView does not resize the layout
  // viewport for the on-screen keyboard (interactive-widget is ignored):
  // track the visual viewport and publish the covered height as
  // --dsh-keyboard-inset on the root element, flagging data-dsh-keyboard.
  // base.css then shrinks the app mount to the remaining visual viewport so
  // the browser does not pan the page (which would scroll the header and
  // sidebar off-screen); the sticky composer rides the reduced height. A
  // small offset (address bar, browser chrome) is treated as no keyboard.
  useEffect(() => {
    const viewport = window.visualViewport
    const html = document.documentElement
    // Loose null: engines without visualViewport expose it as undefined
    // (jsdom) or null; both mean "no keyboard geometry to track".
    if (viewport == null) return
    const update = (): void => {
      // Detect the keyboard as a shrink of the visual viewport below the
      // layout (ICB) height. Reporters disagree on whether innerHeight also
      // shrinks on the IME-active shell, so take the larger of innerHeight and
      // the documentElement client height (the ICB, which `dvh` resolves to and
      // which stays fixed in resizes-visual). A fixed threshold separates
      // browser chrome (< ~100px) from a software keyboard (> ~200px); a ratio
      // against this tall baseline would miss it.
      const layoutHeight = Math.max(window.innerHeight, document.documentElement.clientHeight)
      const inset = layoutHeight - viewport.height
      const keyboard = inset > 150
      if (keyboard) {
        html.style.setProperty('--dsh-keyboard-inset', `${inset}px`)
        // Size the app mount to the live visual viewport height rather than
        // `calc(100dvh - var(--dsh-keyboard-inset))`: on the IME-active shell
        // innerHeight and the ICB can disagree, and `dvh` is a large-viewport
        // unit, so the subtraction over/under-shoots and leaves a gap between
        // the composer and the keyboard. The visual viewport IS the visible
        // area, so its height sizes the app exactly.
        html.style.setProperty('--dsh-viewport-height', `${viewport.height}px`)
        html.setAttribute('data-dsh-keyboard', 'open')
      } else {
        html.style.setProperty('--dsh-keyboard-inset', '0px')
        html.style.removeProperty('--dsh-viewport-height')
        html.removeAttribute('data-dsh-keyboard')
      }
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      html.style.removeProperty('--dsh-keyboard-inset')
      html.style.removeProperty('--dsh-viewport-height')
      html.removeAttribute('data-dsh-keyboard')
    }
  }, [])

  return (
    <div className={css.root} data-phase={phase}>
      {renderSlot('conversation.header', {})}
      {renderFactorySlot('conversation.content', {
        variant: 'main',
        phase,
        hero,
      }, {
        slots: { widthControls: ConversationWidthControls },
      })}
    </div>
  )
}
