import { useCallback, useEffect, useRef, useState } from 'react';

function StatusPill({ good, children }) {
  return <span className={`status-pill ${good ? 'good' : 'bad'}`}><span className="status-dot" />{children}</span>;
}

export default function App() {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [answer, setAnswer] = useState('');
  const [language, setLanguage] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('Ready. Start recording to capture a question.');
  const [runtime, setRuntime] = useState(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  const refreshStatus = useCallback(async () => {
    try {
      const result = await window.parakeet.getRuntimeStatus();
      setRuntime(result);
    } catch (err) {
      setRuntime({ python: { available: false, error: err.message }, ollama: { available: false, error: err.message } });
    }
  }, []);

  useEffect(() => {
    refreshStatus();
    const removeChunkListener = window.parakeet.onAnswerChunk((token) => {
      setAnswer((current) => current + token);
    });
    const removeDoneListener = window.parakeet.onAnswerDone(() => setGenerating(false));
    return () => {
      removeChunkListener();
      removeDoneListener();
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    };
  }, [refreshStatus]);

  const transcribeBlob = useCallback(async (blob) => {
    setTranscribing(true);
    setNotice('Transcribing locally with Whisper Tiny…');
    setError('');
    setAnswer('');
    try {
      const result = await window.parakeet.transcribeAudio(await blob.arrayBuffer());
      const text = result.text || '';
      setTranscript(text);
      setLanguage(result.language ? `${result.language.toUpperCase()} detected` : '');
      if (text) setNotice('Transcription complete. You can now suggest an answer.');
      else setNotice('No speech was detected. Try speaking closer to the microphone.');
    } catch (err) {
      setError(err.message || 'Transcription failed.');
      setNotice('Transcription could not be completed.');
    } finally {
      setTranscribing(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }
  }, []);

  const startRecording = async () => {
    setError('');
    setTranscript('');
    setAnswer('');
    setLanguage('');
    setNotice('Requesting microphone access…');
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        throw new Error('This system does not support browser microphone recording. Please update Windows and Electron.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      streamRef.current = stream;
      chunksRef.current = [];
      const preferredType = 'audio/webm;codecs=opus';
      const recorder = MediaRecorder.isTypeSupported(preferredType)
        ? new MediaRecorder(stream, { mimeType: preferredType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = (event) => {
        setError(event.error?.message || 'Microphone recording failed.');
        setRecording(false);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size > 0) await transcribeBlob(blob);
        else {
          setError('No audio was captured. Check your microphone and try again.');
          setNotice('No audio captured.');
          if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };
      recorder.start(250);
      setRecording(true);
      setNotice('Listening… speak your question, then press Stop.');
    } catch (err) {
      setRecording(false);
      setNotice('Microphone could not be started.');
      setError(err.name === 'NotAllowedError'
        ? 'Microphone permission was denied. Allow microphone access in Windows Settings and restart the app.'
        : err.message || 'Could not access the microphone.');
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      setRecording(false);
      setNotice('Recording stopped. Preparing transcription…');
      recorder.stop();
    }
  };

  const suggestAnswer = async () => {
    if (!transcript.trim()) return;
    setError('');
    setAnswer('');
    setGenerating(true);
    setNotice('Generating an answer locally with Ollama…');
    try {
      await window.parakeet.suggestAnswer(transcript);
      setGenerating(false);
      setNotice('Answer generated locally.');
    } catch (err) {
      setGenerating(false);
      setError(err.message || 'Could not generate an answer.');
      setNotice('AI answer generation failed.');
    }
  };

  const clearConversation = () => {
    if (recording) stopRecording();
    setTranscript('');
    setAnswer('');
    setLanguage('');
    setError('');
    setNotice('Cleared. Start recording to capture a new question.');
  };

  const canSuggest = Boolean(transcript.trim()) && !recording && !transcribing && !generating;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-icon"><span className="brand-wave">∿</span></div>
          <div>
            <div className="brand-name">PARAKEET <span>LOCAL</span></div>
            <div className="brand-subtitle">VOICE ASSISTANT PROTOTYPE</div>
          </div>
        </div>
        <div className="local-label"><span className="local-indicator" /> LOCAL INFERENCE</div>
      </header>

      <section className="intro">
        <div className="eyebrow">YOUR PRIVATE DESKTOP COPILOT</div>
        <h1>Speak naturally.<br /><span>Get a thoughtful answer.</span></h1>
        <p>Record a question, transcribe it on this computer, and generate a suggested answer with a locally running language model.</p>
      </section>

      <section className="workspace">
        <div className="workspace-head">
          <div>
            <div className="section-kicker">01 / AUDIO INPUT</div>
            <h2>Capture your question</h2>
          </div>
          <div className={`record-state ${recording ? 'is-recording' : ''}`}>
            <span className="record-state-dot" />{recording ? 'RECORDING' : transcribing ? 'TRANSCRIBING' : 'STANDBY'}
          </div>
        </div>

        <div className={`recorder-panel ${recording ? 'active' : ''}`}>
          <div className="mic-orb"><span className="mic-glyph">⌁</span></div>
          <div className="recorder-copy">
            <strong>{recording ? 'I’m listening…' : transcribing ? 'Converting speech to text' : 'Ready when you are'}</strong>
            <span>{recording ? 'Speak clearly, then select Stop recording.' : transcribing ? 'Whisper Tiny is processing your audio locally.' : 'Select Start recording and ask your question out loud.'}</span>
          </div>
          <div className="recorder-actions">
            <button className="button button-primary" onClick={startRecording} disabled={recording || transcribing || generating}>
              <span className="button-symbol">●</span> Start
            </button>
            <button className="button button-stop" onClick={stopRecording} disabled={!recording}>
              <span className="stop-square" /> Stop
            </button>
          </div>
        </div>

        <div className="panel-grid">
          <article className="content-card transcript-card">
            <div className="card-heading">
              <div><span className="mini-icon">Aa</span><h3>Transcription</h3></div>
              {language && <span className="language-tag">{language}</span>}
            </div>
            <div className={`content-area ${transcript ? 'has-content' : ''}`}>
              {transcribing ? <div className="loading-line"><span className="spinner" /> Processing your recording…</div>
                : transcript || <span className="placeholder">Your recognized speech will appear here after you stop recording.</span>}
            </div>
            <div className="card-footer"><span className="tiny-dot" /> PROCESSED ON THIS DEVICE</div>
          </article>

          <article className="content-card answer-card">
            <div className="card-heading">
              <div><span className="mini-icon sparkle">✳</span><h3>Suggested answer</h3></div>
              {generating && <span className="generating-tag"><span className="spinner small" /> GENERATING</span>}
            </div>
            <div className={`content-area answer-area ${answer ? 'has-content' : ''}`}>
              {answer ? <>{answer}{generating && <span className="cursor">▍</span>}</>
                : generating ? <div className="loading-line"><span className="spinner" /> Starting local model…</div>
                  : <span className="placeholder">Your AI-generated answer will stream into this space.</span>}
            </div>
            <div className="card-footer"><span className="tiny-dot purple" /> GENERATED WITH LOCAL OLLAMA MODEL</div>
          </article>
        </div>

        <div className="action-row">
          <div className="action-note"><span className="shortcut-dot">✦</span><span>Review the transcription before generating an answer.</span></div>
          <div className="action-buttons">
            <button className="button button-quiet" onClick={clearConversation} disabled={recording || transcribing || generating}>Clear</button>
            <button className="button button-suggest" onClick={suggestAnswer} disabled={!canSuggest}>
              {generating ? <><span className="spinner button-spinner" /> Generating…</> : <>✧ Suggest answer <span className="arrow">↗</span></>}
            </button>
          </div>
        </div>

        {error && <div className="error-banner"><span>!</span><div>{error}</div></div>}
        <div className="notice-line"><span className="notice-icon">i</span>{notice}</div>
      </section>

      <section className="runtime-panel">
        <div className="runtime-title"><div><div className="section-kicker">RUNTIME CHECK</div><h3>Local services</h3></div><button className="refresh-button" onClick={refreshStatus}>↻ Refresh</button></div>
        <div className="runtime-items">
          <div className="runtime-item">
            <div className="runtime-symbol whisper-symbol">W</div>
            <div className="runtime-details"><strong>Whisper / Python</strong><span>{runtime?.python?.available ? `Ready · Python ${runtime.python.version}` : runtime ? 'Not ready · install backend dependencies' : 'Checking…'}</span></div>
            {runtime && <StatusPill good={Boolean(runtime.python?.available)}>{runtime.python?.available ? 'READY' : 'SETUP'}</StatusPill>}
          </div>
          <div className="runtime-item">
            <div className="runtime-symbol ollama-symbol">◎</div>
            <div className="runtime-details"><strong>Ollama / {runtime?.ollama?.model || 'local model'}</strong><span>{runtime?.ollama?.available ? runtime.ollama.modelInstalled ? 'Server online · model downloaded' : 'Server online · model not downloaded' : runtime ? 'Server not detected · start Ollama' : 'Checking…'}</span></div>
            {runtime && <StatusPill good={Boolean(runtime.ollama?.available && runtime.ollama?.modelInstalled)}>{runtime.ollama?.available ? runtime.ollama.modelInstalled ? 'READY' : 'PULL MODEL' : 'OFFLINE'}</StatusPill>}
          </div>
        </div>
      </section>

      <footer className="app-footer"><span>PARAKEET LOCAL ASSISTANT · PROTOTYPE</span><span>Audio and prompts stay on your computer during inference.</span></footer>
    </main>
  );
}
