/**
 * The document path currently shown in the editor.
 *
 * Live preview widgets and the table renderer both need it to resolve relative
 * image and link targets. It lives in its own module so importing it does not
 * create a cycle between `livePreview` and `widgets`.
 */
let currentDocPath: string | null = null

export function setPreviewDocPath(path: string | null): void {
  currentDocPath = path
}

export function getPreviewDocPath(): string | null {
  return currentDocPath
}
