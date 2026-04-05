const statusEl = document.getElementById('status');
const hostEl = document.getElementById('host');
const portEl = document.getElementById('port');
const actionEl = document.getElementById('action');
const titleEl = document.getElementById('title');
const promptEl = document.getElementById('prompt');

function setStatus(message) {
  statusEl.textContent = message;
}

function endpoint() {
  return `ws://${hostEl.value.trim() || '127.0.0.1'}:${portEl.value.trim() || '47831'}`;
}

async function getSelectionText(tabId) {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => window.getSelection ? window.getSelection().toString() : '',
    });
    return typeof result?.result === 'string' ? result.result.trim() : '';
  } catch {
    return '';
  }
}

async function getCurrentTabContext() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error('No active tab found.');
  }
  const selection = await getSelectionText(tab.id);
  return {
    title: tab.title || 'Browser context',
    url: tab.url || '',
    selection,
  };
}

function buildFromAction(action, context) {
  const selected = context.selection ? `Selected text:\n${context.selection}` : 'Selected text: none';
  const urlSection = context.url ? `URL: ${context.url}` : 'URL: unavailable';

  if (action === 'summarize') {
    return {
      title: `Summarize: ${context.title}`,
      prompt: [
        'Open this page context and provide a concise summary.',
        'Return: key points, risks, and next actions.',
        urlSection,
        selected,
      ].join('\n\n'),
    };
  }

  if (action === 'rewrite') {
    return {
      title: `Rewrite: ${context.title}`,
      prompt: [
        'Open this page context and rewrite the selected text for clarity.',
        'Return: plain version + polished version.',
        urlSection,
        selected,
      ].join('\n\n'),
    };
  }

  if (action === 'extract_tasks') {
    return {
      title: `Task extraction: ${context.title}`,
      prompt: [
        'Open this page context and extract actionable tasks.',
        'Return: priority, owner suggestion, and due-date suggestion.',
        urlSection,
        selected,
      ].join('\n\n'),
    };
  }

  if (action === 'analyze') {
    return {
      title: `Deep analysis: ${context.title}`,
      prompt: [
        'Open this page context and analyze it deeply.',
        'Return: summary, evidence, assumptions, and recommended next actions.',
        urlSection,
        selected,
      ].join('\n\n'),
    };
  }

  return {
    title: `Review page: ${context.title}`,
    prompt: [
      'Open the browser context related to this page and continue the workflow.',
      urlSection,
      selected,
    ].join('\n\n'),
  };
}

async function fillFromCurrentTab() {
  const context = await getCurrentTabContext();
  const action = actionEl.value || 'summarize';
  const draft = buildFromAction(action, context);
  titleEl.value = draft.title;
  promptEl.value = draft.prompt;
  setStatus(`Loaded current tab for "${action}" action.`);
}

async function fillFromSelectionOnly() {
  const context = await getCurrentTabContext();
  const action = actionEl.value || 'rewrite';
  const draft = buildFromAction(action, { ...context, title: context.title, url: context.url, selection: context.selection || '(No text selected)' });
  titleEl.value = draft.title;
  promptEl.value = draft.prompt;
  setStatus('Loaded selected text into prompt.');
}

async function sendDispatch() {
  const title = titleEl.value.trim();
  const prompt = promptEl.value.trim();
  if (!title || !prompt) {
    setStatus('Title and prompt are required.');
    return;
  }

  setStatus('Connecting to Dispatch...');
  const socket = new WebSocket(endpoint());

  socket.addEventListener('open', () => {
    socket.send(JSON.stringify({
      type: 'dispatch.enqueue',
      title,
      prompt,
      source: 'chrome-extension',
      tags: ['chrome-extension', actionEl.value || 'custom'],
    }));
  });

  socket.addEventListener('message', (event) => {
    try {
      const parsed = JSON.parse(event.data);
      if (parsed.type === 'dispatch_state') {
        return;
      }
      if (parsed.ok === false) {
        setStatus(parsed.error || 'Dispatch rejected the request.');
      } else {
        setStatus(`Queued: ${parsed.task ? parsed.task.title : title}`);
      }
    } catch {
      setStatus('Dispatch accepted the request.');
    }
    socket.close();
  });

  socket.addEventListener('error', () => {
    setStatus('Unable to connect. Make sure the desktop app Dispatch server is running.');
  });
}

document.getElementById('fill').addEventListener('click', () => {
  void fillFromCurrentTab();
});

document.getElementById('selection').addEventListener('click', () => {
  void fillFromSelectionOnly();
});

document.getElementById('send').addEventListener('click', () => {
  void sendDispatch();
});

actionEl.addEventListener('change', () => {
  void fillFromCurrentTab();
});

chrome.storage.sync.get(['dispatchHost', 'dispatchPort'], (values) => {
  if (typeof values.dispatchHost === 'string') {
    hostEl.value = values.dispatchHost;
  }
  if (typeof values.dispatchPort === 'string') {
    portEl.value = values.dispatchPort;
  }
});

hostEl.addEventListener('change', () => {
  chrome.storage.sync.set({ dispatchHost: hostEl.value.trim() });
});

portEl.addEventListener('change', () => {
  chrome.storage.sync.set({ dispatchPort: portEl.value.trim() });
});

void fillFromCurrentTab();
