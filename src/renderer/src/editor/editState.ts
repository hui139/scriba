import { StateEffect } from '@codemirror/state'

/** Force a full live-preview rebuild (used after doc switches and edits end). */
export const forcePreviewRebuild = StateEffect.define<null>()
