export async function createEditorAudioCapture(signal: AbortSignal): Promise<{
  recorder: MediaRecorder;
  release(): void;
}> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const stopTracks = () => stream.getTracks().forEach((track) => track.stop());
  if (signal.aborted) {
    stopTracks();
    throw new DOMException("Recording cancelled", "AbortError");
  }
  try {
    const mimeType = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm"].find(
      (candidate) => MediaRecorder.isTypeSupported(candidate),
    );
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    const abort = () => {
      recorder.onstop = null;
      recorder.ondataavailable = null;
      try {
        if (recorder.state !== "inactive") recorder.stop();
      } finally {
        stopTracks();
      }
    };
    signal.addEventListener("abort", abort, { once: true });
    return {
      recorder,
      release() {
        signal.removeEventListener("abort", abort);
        stopTracks();
      },
    };
  } catch (error) {
    stopTracks();
    throw error;
  }
}
