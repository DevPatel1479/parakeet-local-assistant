const DEFAULT_SYSTEM_PROMPT = [
  'You are a helpful, accurate interview and question-answering assistant.',
  'Answer the user question directly in clear, natural language.',
  'Prefer a concise answer with a short example when useful.',
  'Do not claim to have personal experiences. If the question is unclear, state the assumption.'
].join(' ');

/** Stream a chat completion from the local Ollama HTTP API. */
async function streamOllamaChat({
  baseUrl = 'http://127.0.0.1:11434',
  model = 'qwen2.5:0.5b-instruct',
  question,
  onToken = () => {},
  fetchImpl = global.fetch
}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('This Electron version does not provide fetch. Please update Node/Electron.');
  }

  const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: true,
      keep_alive: 0,
      messages: [
        { role: 'system', content: DEFAULT_SYSTEM_PROMPT },
        { role: 'user', content: question }
      ],
      options: {
        temperature: 0.35,
        num_ctx: 2048,
        num_predict: 280
      }
    })
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    if (response.status === 404) {
      throw new Error(`Ollama could not find model "${model}". Run: ollama pull ${model}`);
    }
    throw new Error(`Ollama returned HTTP ${response.status}${details ? `: ${details}` : ''}`);
  }
  if (!response.body) throw new Error('Ollama returned an empty response stream.');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullAnswer = '';

  const handleLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    let item;
    try {
      item = JSON.parse(trimmed);
    } catch {
      throw new Error(`Could not parse Ollama response: ${trimmed.slice(0, 180)}`);
    }
    if (item.error) throw new Error(item.error);
    const token = item.message?.content || '';
    if (token) {
      fullAnswer += token;
      onToken(token);
    }
    return Boolean(item.done);
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (handleLine(line)) return fullAnswer;
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) handleLine(buffer);
  } finally {
    reader.releaseLock();
  }

  return fullAnswer;
}

module.exports = { streamOllamaChat };
