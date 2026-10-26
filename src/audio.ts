let context: AudioContext | null = null;
let timer: number | null = null;
let step = 0;
let muted = localStorage.getItem("rd-muted") === "true";

function tone(
  frequency: number,
  duration: number,
  volume: number,
  type: OscillatorType = "sine",
) {
  if (muted || !context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + 0.03);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    context.currentTime + duration,
  );
  oscillator.connect(gain).connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration + 0.02);
}

export function startAudio() {
  if (muted) return;
  context ??= new AudioContext();
  void context.resume();
  if (timer !== null) return;
  const notes = [220, 261.63, 329.63, 293.66, 196, 246.94, 329.63, 261.63];
  timer = window.setInterval(() => {
    tone(notes[step % notes.length], 1.5, 0.012);
    if (step % 4 === 0) tone(notes[step % notes.length] / 2, 1.8, 0.008);
    step++;
  }, 680);
}

export function playCue(kind: "select" | "pour" | "invalid" | "win") {
  if (kind === "select") tone(470, 0.12, 0.035);
  if (kind === "pour") {
    tone(390, 0.2, 0.035);
    window.setTimeout(() => tone(580, 0.22, 0.025), 100);
  }
  if (kind === "invalid") tone(160, 0.2, 0.03, "triangle");
  if (kind === "win")
    [392, 494, 587, 784].forEach((note, i) =>
      window.setTimeout(() => tone(note, 0.42, 0.045), i * 135),
    );
}

export function isMuted() {
  return muted;
}
export function toggleMute() {
  muted = !muted;
  localStorage.setItem("rd-muted", String(muted));
  if (muted && timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
  if (!muted) startAudio();
  return muted;
}
