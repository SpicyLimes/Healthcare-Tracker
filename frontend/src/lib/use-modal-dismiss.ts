import * as React from "react"

/**
 * Escape-to-close plus mount focus for modal overlays.
 *
 * The overlays previously bound Escape via React's `onKeyDown` on the backdrop
 * div. That div had no `tabIndex` and nothing focused it on mount, so
 * `document.activeElement` stayed on `<body>` and the bubbling handler never
 * fired — Escape did nothing until the user first clicked inside the modal.
 *
 * Listening on `document` makes the key work regardless of where focus sits,
 * and focusing the overlay on mount moves the caret out of the page behind it
 * so screen readers and tab order start inside the dialog.
 *
 * Returns a ref to attach to the overlay element.
 */
export function useModalDismiss(onClose: () => void) {
  const ref = React.useRef<HTMLDivElement>(null)

  // Keep the latest callback without re-binding the listener each render.
  const onCloseRef = React.useRef(onClose)
  React.useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation()
        onCloseRef.current()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  React.useEffect(() => {
    ref.current?.focus()
  }, [])

  return ref
}
