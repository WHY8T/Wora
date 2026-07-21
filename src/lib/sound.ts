let ctx: AudioContext | null = null;

function getContext() {
    if (typeof window === "undefined") return null;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    return ctx;
}

/** Browsers require a user gesture before audio can play. Call this once on
 * the first click/keypress anywhere in the app so the chime isn't silently
 * blocked the first time a real notification arrives later, unprompted. */
export function unlockAudioOnFirstInteraction() {
    const audioCtx = getContext();
    if (audioCtx && audioCtx.state === "suspended") void audioCtx.resume();
}

/** A short, pleasant two-note chime for new notifications — synthesized so
 * there's no audio file to ship, host, or have go missing. */
export function playNotificationChime() {
    const audioCtx = getContext();
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") void audioCtx.resume();

    const now = audioCtx.currentTime;
    const notes: Array<{ freq: number; start: number; duration: number }> = [
        { freq: 880, start: 0, duration: 0.14 },
        { freq: 1318.5, start: 0.09, duration: 0.22 },
    ];

    for (const note of notes) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = note.freq;
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        const startAt = now + note.start;
        const endAt = startAt + note.duration;
        gain.gain.setValueAtTime(0, startAt);
        gain.gain.linearRampToValueAtTime(0.22, startAt + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

        osc.start(startAt);
        osc.stop(endAt + 0.02);
    }
}