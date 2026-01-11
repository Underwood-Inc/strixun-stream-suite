import React, { useState } from 'react';
import { CodeBlock } from './CodeBlock';
import './MultiFileViewer.css';

export interface FileViewerFile {
  name: string;
  path: string;
  language: string;
  content: string;
  description?: string;
}

interface MultiFileViewerProps {
  files: FileViewerFile[];
}

function getFileIcon(filename: string): string {
  if (filename.endsWith('.tsx') || filename.endsWith('.jsx')) return '⚛';
  if (filename.endsWith('.ts')) return 'TS';
  if (filename.endsWith('.js')) return 'JS';
  if (filename.endsWith('.svelte')) return 'S';
  if (filename.endsWith('.json')) return '{}';
  if (filename.endsWith('.html')) return 'H';
  if (filename.endsWith('.css') || filename.endsWith('.scss')) return '🎨';
  if (filename.endsWith('.env')) return '🔒';
  return '📄';
}

export function MultiFileViewer({ files }: MultiFileViewerProps) {
  const [activeFile, setActiveFile] = useState(0);

  const currentFile = files[activeFile];

  return (
    <div className="multi-file-viewer">
      <div className="file-sidebar">
        <div className="sidebar-header">
          <span className="folder-icon">📁</span>
          <span className="project-name">project</span>
        </div>
        <div className="file-list">
          {files.map((file, index) => (
            <button
              key={index}
              className={`file-item ${activeFile === index ? 'active' : ''}`}
              onClick={() => setActiveFile(index)}
            >
              <span className="file-icon">{getFileIcon(file.name)}</span>
              <span className="file-name">{file.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="file-content">
        <div className="file-tabs">
          <div className="tab active">
            <span className="tab-icon">{getFileIcon(currentFile.name)}</span>
            <span className="tab-name">{currentFile.name}</span>
            <span className="tab-path">{currentFile.path}</span>
          </div>
        </div>

        {currentFile.description && (
          <div 
            className="file-description" 
            dangerouslySetInnerHTML={{ __html: currentFile.description }}
          />
        )}

        <div className="code-container">
          <CodeBlock 
            code={currentFile.content} 
            language={currentFile.language}
          />
        </div>
      </div>
    </div>
  );
}
