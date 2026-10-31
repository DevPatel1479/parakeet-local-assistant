const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('parakeet', {
  transcribeAudio: (audioBytes) => ipcRenderer.invoke('transcribe-audio', audioBytes),
  suggestAnswer: (question) => ipcRenderer.invoke('suggest-answer', question),
  getRuntimeStatus: () => ipcRenderer.invoke('get-runtime-status'),
  onAnswerChunk: (callback) => {
    const listener = (_event, token) => callback(token);
    ipcRenderer.on('answer:chunk', listener);
    return () => ipcRenderer.removeListener('answer:chunk', listener);
  },
  onAnswerDone: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('answer:done', listener);
    return () => ipcRenderer.removeListener('answer:done', listener);
  }
});
