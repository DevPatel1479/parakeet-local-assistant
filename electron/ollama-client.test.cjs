const test = require('node:test');
const assert = require('node:assert/strict');
const { streamOllamaChat } = require('./ollama-client.cjs');

function fakeResponse(chunks, status = 200) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    }
  });
  return {
    ok: status >= 200 && status < 300,
    status,
    body,
    text: async () => 'fake error'
  };
}

test('streams Ollama chunks and joins the complete answer', async () => {
  const chunksReceived = [];
  const answer = await streamOllamaChat({
    question: 'What is React?',
    onToken: (token) => chunksReceived.push(token),
    fetchImpl: async (_url, options) => {
      const payload = JSON.parse(options.body);
      assert.equal(payload.stream, true);
      assert.equal(payload.keep_alive, 0);
      return fakeResponse([
        '{"message":{"content":"React "},"done":false}\n',
        '{"message":{"content":"is a UI library."},"done":false}\n',
        '{"message":{"content":""},"done":true}\n'
      ]);
    }
  });

  assert.equal(answer, 'React is a UI library.');
  assert.deepEqual(chunksReceived, ['React ', 'is a UI library.']);
});

test('reports an absent Ollama model with the pull command', async () => {
  await assert.rejects(
    () => streamOllamaChat({
      question: 'Hello',
      model: 'model-that-does-not-exist',
      fetchImpl: async () => fakeResponse([], 404)
    }),
    /ollama pull model-that-does-not-exist/
  );
});
