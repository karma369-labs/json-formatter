import { useState, type DragEvent, type ReactNode } from 'react';
import { UploadCloud } from 'lucide-react';
import './FileDropZone.css';

interface FileDropZoneProps {
  onFile: (content: string, fileName: string) => void;
  children: ReactNode;
}

export function FileDropZone({ onFile, children }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        onFile(content, file.name);
      }
    };
    reader.readAsText(file);
  }

  return (
    <div
      className="file-drop-zone"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
      {isDragging ? (
        <div className="file-drop-overlay">
          <div className="file-drop-card">
            <UploadCloud size={48} />
            <span className="file-drop-title">Drop JSON file here</span>
            <span className="file-drop-subtitle">File will be automatically formatted and loaded</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
