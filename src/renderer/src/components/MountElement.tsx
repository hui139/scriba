import { useEffect, useRef } from 'react'

export function MountElement({
  element,
  className
}: {
  element: HTMLElement
  className?: string
}): JSX.Element {
  const hostRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    host.appendChild(element)
    return () => {
      if (element.parentElement === host) host.removeChild(element)
    }
  }, [element])

  return <span ref={hostRef} className={className} />
}
