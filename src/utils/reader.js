export function normalizeReaderItems(contents, lines) {
  return (contents || [])
    .map((item, index) => {
      if (item.content_type === 1) {
        return {
          id: `text-${index}`,
          type: 'text',
          title: String(item.name || '').trim(),
          startLine: item.start_lines,
          endLine: item.end_lines,
          text: sliceLines(lines, item.start_lines, item.end_lines)
        };
      }

      if (item.content_type === 2) {
        return {
          id: `image-${index}`,
          type: 'image',
          title: String(item.name || '').trim(),
          url: item.content
        };
      }

      return null;
    })
    .filter(Boolean);
}

export function sliceLines(lines, startLine, endLine) {
  const start = Math.max((startLine || 1) - 1, 0);
  const end = Math.max((endLine || startLine || 1) - 1, start);
  return lines.slice(start, end).join('\n').trim();
}

export function loadReaderSettings() {
  const raw = localStorage.getItem('reader-settings');
  if (!raw) {
    return {
      fontSize: 20,
      lineHeight: 1.9,
      fontFamily: 'var(--reader-font-serif)'
    };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      fontSize: parsed.fontSize || 20,
      lineHeight: parsed.lineHeight || 1.9,
      fontFamily: parsed.fontFamily || 'var(--reader-font-serif)'
    };
  } catch {
    return {
      fontSize: 20,
      lineHeight: 1.9,
      fontFamily: 'var(--reader-font-serif)'
    };
  }
}

export function saveReaderSettings(settings) {
  localStorage.setItem('reader-settings', JSON.stringify(settings));
}

export function loadReadingProgress() {
  const raw = localStorage.getItem('reader-progress');
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveReadingProgress(progress) {
  localStorage.setItem('reader-progress', JSON.stringify(progress));
}

function readJsonStorage(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function loadHistory() {
  return readJsonStorage('reader-history', {
    books: [],
    volumes: []
  });
}

export function saveHistory(history) {
  localStorage.setItem('reader-history', JSON.stringify(history));
}

export function pushBookHistory(entry) {
  const history = loadHistory();
  const nextBooks = [entry, ...history.books.filter((item) => item.pathWord !== entry.pathWord)].slice(0, 12);
  const nextHistory = {
    ...history,
    books: nextBooks
  };
  saveHistory(nextHistory);
  return nextHistory;
}

export function pushVolumeHistory(entry) {
  const history = loadHistory();
  const nextVolumes = [
    entry,
    ...history.volumes.filter((item) => item.pathWord !== entry.pathWord)
  ].slice(0, 20);
  const nextHistory = {
    ...history,
    volumes: nextVolumes
  };
  saveHistory(nextHistory);
  return nextHistory;
}
