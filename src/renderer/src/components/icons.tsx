import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Base({ size = 16, children, ...props }: IconProps): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  )
}

export const FolderOpenIcon = (p: IconProps): JSX.Element => (
  <Base {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    <path d="m3 11 2.2 4.5A2 2 0 0 0 7 17h12" />
  </Base>
)

export const PanelLeftIcon = (p: IconProps): JSX.Element => (
  <Base {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16" />
  </Base>
)

export const FilesIcon = (p: IconProps): JSX.Element => (
  <Base {...p}>
    <path d="M8 3h6l4 4v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
    <path d="M14 3v4h4" />
    <path d="M9.5 12h5M9.5 16h5" />
  </Base>
)

export const ListIcon = (p: IconProps): JSX.Element => (
  <Base {...p}>
    <path d="M8 6h12M8 12h12M8 18h12" />
    <path d="M4 6h.01M4 12h.01M4 18h.01" />
  </Base>
)

export const PlugIcon = (p: IconProps): JSX.Element => (
  <Base {...p}>
    <path d="M9 3v4M15 3v4" />
    <path d="M7 7h10v3a5 5 0 0 1-10 0Z" />
    <path d="M12 15v6" />
  </Base>
)

export const SunIcon = (p: IconProps): JSX.Element => (
  <Base {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Base>
)

export const MoonIcon = (p: IconProps): JSX.Element => (
  <Base {...p}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
  </Base>
)

export const CommandIcon = (p: IconProps): JSX.Element => (
  <Base {...p}>
    <path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3Z" />
  </Base>
)

export const SearchIcon = (p: IconProps): JSX.Element => (
  <Base {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Base>
)

export const PlusIcon = (p: IconProps): JSX.Element => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
)

export const RefreshIcon = (p: IconProps): JSX.Element => (
  <Base {...p}>
    <path d="M21 12a9 9 0 1 1-2.6-6.4" />
    <path d="M21 4v5h-5" />
  </Base>
)

export const ChevronRightIcon = (p: IconProps): JSX.Element => (
  <Base {...p}>
    <path d="m9 6 6 6-6 6" />
  </Base>
)

export const FileTextIcon = (p: IconProps): JSX.Element => (
  <Base {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
    <path d="M14 3v5h5" />
  </Base>
)

export const FolderIcon = (p: IconProps): JSX.Element => (
  <Base {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
  </Base>
)

export const SaveIcon = (p: IconProps): JSX.Element => (
  <Base {...p}>
    <path d="M5 3h11l3 3v15H5Z" />
    <path d="M8 3v6h7V3M8 21v-7h8v7" />
  </Base>
)

export const XIcon = (p: IconProps): JSX.Element => (
  <Base {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Base>
)

export const TrashIcon = (p: IconProps): JSX.Element => (
  <Base {...p}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13h10l1-13" />
  </Base>
)

export const DownloadIcon = (p: IconProps): JSX.Element => (
  <Base {...p}>
    <path d="M12 3v12M7 10l5 5 5-5" />
    <path d="M4 19h16" />
  </Base>
)

export const FocusIcon = (p: IconProps): JSX.Element => (
  <Base {...p}>
    <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" />
  </Base>
)

export const TypeIcon = (p: IconProps): JSX.Element => (
  <Base {...p}>
    <path d="M4 6V4h16v2M12 4v16M8 20h8" />
  </Base>
)

export const SettingsIcon = (p: IconProps): JSX.Element => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.3 3a7 7 0 0 0-1.7 1l-2.4-1-2 3.5L5.1 11a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.7 1l.3 3h5l.3-3a7 7 0 0 0 1.7-1l2.4 1 2-3.5-2-1.5a7 7 0 0 0 .1-1Z" />
  </Base>
)

export const GlobeIcon = (p: IconProps): JSX.Element => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18" />
    <path d="M12 3c2.5 2.5 3.8 5.6 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.6-3.8-9S9.5 5.5 12 3Z" />
  </Base>
)
