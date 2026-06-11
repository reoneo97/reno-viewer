import { useState } from 'react'
import { useEscapeKey } from '../hooks/useEscapeKey'

interface Props {
  onClose: () => void
}

const TUTORIAL_SEEN_KEY = 'reno-tutorial-seen'

export function hasSeenTutorial(): boolean {
  return localStorage.getItem(TUTORIAL_SEEN_KEY) === '1'
}

export function markTutorialSeen(): void {
  localStorage.setItem(TUTORIAL_SEEN_KEY, '1')
}

interface Section {
  title: string
  body: React.ReactNode
}

const SECTIONS: Section[] = [
  {
    title: 'Welcome',
    body: (
      <>
        <p>
          Reno Viewer is a planning board for your renovation. You pin the spots
          you're furnishing on a floor plan, collect product options under each
          pin, and decide what to buy — with the budget adding itself up as you go.
        </p>
        <p>
          This tour takes about two minutes. You can reopen it any time from the
          account menu in the top-right corner.
        </p>
      </>
    ),
  },
  {
    title: 'Your floor plan',
    body: (
      <>
        <p>
          Each project starts with a floor plan image — a photo or PDF screenshot
          of your unit works fine. Load it with <strong>Load Floor Plan</strong> in
          the toolbar.
        </p>
        <ul>
          <li><strong>Pan</strong> by dragging, <strong>zoom</strong> with the scroll wheel, pinch on touch screens, or use the +/− controls.</li>
          <li>You can swap the floor plan later without losing your pins — they're stored as percentages, so they stay in place.</li>
        </ul>
      </>
    ),
  },
  {
    title: 'Placing pins',
    body: (
      <>
        <p>
          Pins (anchors) mark the spots you're furnishing — a sofa wall, a pendant
          light, the vanity.
        </p>
        <ul>
          <li>Toggle <strong>Edit</strong> in the toolbar, then click anywhere on the plan and confirm <strong>+ Add anchor</strong>.</li>
          <li>In edit mode, <strong>drag</strong> a pin to move it; <strong>double-click</strong> it to open its details.</li>
          <li>Give each pin a label and a category — categories colour the pins and drive the legend and budget.</li>
          <li>Leave edit mode to browse: hover a pin to preview its items, click it to view them in full.</li>
        </ul>
      </>
    ),
  },
  {
    title: 'Adding candidates',
    body: (
      <>
        <p>
          Candidates are the product options you're considering for a pin. Open a
          pin's details and hit the green <strong>＋</strong>.
        </p>
        <ul>
          <li>Add images by <strong>file picker, drag &amp; drop, or pasting from the clipboard</strong> (⌘V / Ctrl+V) — handy when screenshotting from shop pages. A candidate can hold several photos.</li>
          <li>Record the name, description, <strong>W × H × D dimensions, price, and the shop link</strong> so everything lives in one place.</li>
          <li>Fields autosave as you edit; just press Done when finished.</li>
        </ul>
      </>
    ),
  },
  {
    title: 'Deciding',
    body: (
      <>
        <p>
          Every candidate carries a decision status: <strong>Shortlisted</strong>,{' '}
          <strong>Chosen</strong>, or <strong>Rejected</strong>.
        </p>
        <ul>
          <li><strong>Chosen</strong> is the committed pick — only one per pin; choosing a new one clears the old.</li>
          <li>Select up to four candidates in a pin's view and hit <strong>Compare</strong> to see them side by side.</li>
          <li>Chosen items are what the budget counts, so deciding as you go keeps the total honest.</li>
        </ul>
      </>
    ),
  },
  {
    title: 'Reusing candidates',
    body: (
      <>
        <p>
          Buying the same fan for three rooms? Don't re-enter it. In a pin's
          details, hit <strong>⟳ Reuse</strong> to link any candidate that already
          exists elsewhere in the project.
        </p>
        <ul>
          <li>A shared candidate's details (price, photos, link) are the same everywhere — edit once, updated everywhere.</li>
          <li>Its <em>decision</em> is per pin: it can be chosen in the bedroom and still undecided in the study.</li>
          <li>Removing a shared candidate from one pin leaves it on the others; it's only deleted with its last pin.</li>
        </ul>
      </>
    ),
  },
  {
    title: 'Three views',
    body: (
      <>
        <p>The tabs in the toolbar switch between three ways of seeing the same project:</p>
        <ul>
          <li><strong>Plan</strong> — the floor plan with pins. The ☰ button opens an item sidebar; clicking an item there pans the map to its pin.</li>
          <li><strong>All Items</strong> — a sortable, searchable table of every candidate. Update decisions right from the table.</li>
          <li><strong>Budget</strong> — totals by category, committed (chosen) vs. everything you're considering, plus a target budget with a progress bar.</li>
        </ul>
        <p>On the Plan view, click a category in the legend to hide or show those pins.</p>
      </>
    ),
  },
  {
    title: 'Sharing & users',
    body: (
      <>
        <p>
          <strong>Share &amp; Export</strong> in the toolbar gives you three outputs:
        </p>
        <ul>
          <li><strong>Share link</strong> — a read-only page anyone can open, no login needed. Re-sharing updates the same link.</li>
          <li><strong>Download snapshot</strong> — the same thing as a single HTML file you can keep or email.</li>
          <li><strong>Download CSV</strong> — the item list for spreadsheets.</li>
        </ul>
        <p>
          To work on this together, add accounts under the avatar menu →{' '}
          <strong>Manage users</strong>. Everyone sees the same projects. After
          someone else makes changes, reopen the project (or switch tabs) to pick
          them up.
        </p>
      </>
    ),
  },
]

export function HelpModal({ onClose }: Props) {
  const [step, setStep] = useState(0)
  useEscapeKey(onClose)

  const close = () => {
    markTutorialSeen()
    onClose()
  }

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) close()
  }

  const last = step === SECTIONS.length - 1

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal help-modal">
        <div className="modal-header">
          <h2>{SECTIONS[step].title}</h2>
          <button className="icon-btn" aria-label="Close" onClick={close}>✕</button>
        </div>

        <div className="modal-body help-body">
          {SECTIONS[step].body}
        </div>

        <div className="modal-footer help-footer">
          <div className="help-dots" aria-label={`Step ${step + 1} of ${SECTIONS.length}`}>
            {SECTIONS.map((s, i) => (
              <button
                key={s.title}
                className={`help-dot ${i === step ? 'active' : ''}`}
                onClick={() => setStep(i)}
                title={s.title}
                aria-label={s.title}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {step > 0 && (
              <button className="btn-secondary" onClick={() => setStep((s) => s - 1)}>Back</button>
            )}
            <button
              className="btn-primary"
              onClick={() => (last ? close() : setStep((s) => s + 1))}
            >
              {last ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
