// Shared file-reading helper used by both drag-drop and the file picker button.
export async function readTextFile(file: File): Promise<string> {
  return file.text();
}
