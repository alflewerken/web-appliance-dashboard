import React from 'react';
import Convert from 'ansi-to-html';

const convert = new Convert({
  fg: '#FFF',
  bg: '#000',
  newline: true,
  escapeXML: true,
  stream: true,
  colors: {
    0: '#000',
    1: '#C51E14',
    2: '#1DC121',
    3: '#C7C329',
    4: '#0A2FC4',
    5: '#C839C5',
    6: '#20C5C6',
    7: '#C7C7C7',
    8: '#686868',
    9: '#FD6F6B',
    10: '#67F86F',
    11: '#FFFA72',
    12: '#6A76FB',
    13: '#FD7CFC',
    14: '#68FDFE',
    15: '#FFFFFF',
    // Bright colors
    16: '#000000',
    17: '#5C0000',
    18: '#005C00',
    19: '#5C5C00',
    20: '#00005C',
    21: '#5C005C',
    22: '#005C5C',
    23: '#5C5C5C',
  }
});

const AnsiOutput = ({ content, style = {} }) => {
  // Convert ANSI codes to HTML
  const html = convert.toHtml(content || '');
  
  return (
    <div
      style={{
        fontFamily: 'Monaco, Consolas, "Courier New", monospace',
        fontSize: '13px',
        lineHeight: '1.6',
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word',
        color: '#ffffff',
        backgroundColor: 'transparent',
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default AnsiOutput;
