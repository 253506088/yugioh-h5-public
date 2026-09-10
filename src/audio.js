(function (root) {
  'use strict';
  class DuelAudio {
    constructor(prefs) { this.prefs = prefs; this.context = null; this.master = null; this.musicTimer = null; this.musicStep = 0; }
    unlock() {
      if (!this.context) {
        const Audio = root.AudioContext || root.webkitAudioContext;
        if (!Audio) return;
        try {
          this.context = new Audio();
          this.master = this.context.createGain();
          this.master.gain.value = this.prefs.sound ? this.prefs.volume : 0;
          const compressor = this.context.createDynamicsCompressor();
          compressor.threshold.value = -16; compressor.ratio.value = 5;
          this.master.connect(compressor); compressor.connect(this.context.destination);
        } catch { return; }
      }
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      this.update();
    }
    update() {
      if (!this.context) return;
      this.master.gain.setTargetAtTime(this.prefs.sound ? this.prefs.volume : 0, this.context.currentTime, .08);
      if (this.prefs.music && this.prefs.sound && !this.musicTimer) { this.playMusic(); this.musicTimer = setInterval(() => this.playMusic(), 6400); }
      if ((!this.prefs.music || !this.prefs.sound) && this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
    }
    tone(frequency, duration, type = 'sine', volume = .15, delay = 0, endFrequency = null) {
      if (!this.context || this.context.state !== 'running') return;
      const time = this.context.currentTime + delay;
      const osc = this.context.createOscillator(), gain = this.context.createGain();
      osc.type = type; osc.frequency.setValueAtTime(frequency, time);
      if (endFrequency) osc.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
      gain.gain.setValueAtTime(.0001, time); gain.gain.exponentialRampToValueAtTime(Math.max(.0002, volume), time + Math.min(.03, duration / 3));
      gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
      osc.connect(gain); gain.connect(this.master); osc.start(time); osc.stop(time + duration + .05);
      osc.onended = () => { osc.disconnect(); gain.disconnect(); };
    }
    noise(duration = .2, volume = .12, frequency = 1500) {
      if (!this.context || this.context.state !== 'running') return;
      const count = Math.ceil(this.context.sampleRate * duration), buffer = this.context.createBuffer(1, count, this.context.sampleRate), values = buffer.getChannelData(0);
      for (let i = 0; i < count; i++) values[i] = (Math.random() * 2 - 1) * (1 - i / count);
      const source = this.context.createBufferSource(), filter = this.context.createBiquadFilter(), gain = this.context.createGain();
      source.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = frequency; gain.gain.value = volume;
      source.connect(filter); filter.connect(gain); gain.connect(this.master); source.start();
      source.onended = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); };
    }
    play(name) {
      if (!this.prefs.sound || !this.context) return;
      switch (name) {
        case 'click': this.tone(510, .07, 'sine', .055, 0, 350); break;
        case 'card': this.noise(.11, .10, 1900); this.tone(340, .08, 'sine', .06); break;
        case 'draw': this.noise(.18, .16, 2600); this.tone(880, .23, 'sine', .09, .04); break;
        case 'summon': [261.63, 392, 523.25, 783.99].forEach((n, i) => this.tone(n, .8, 'triangle', .13, i * .09)); this.noise(.4, .08, 550); break;
        case 'special': [196, 293.66, 392, 587.33, 783.99].forEach((n, i) => this.tone(n, 1.35, 'triangle', .12, i * .1)); this.tone(65.4, 1.2, 'sine', .22); break;
        case 'spell': [523.25, 659.25, 1046.5].forEach((n, i) => this.tone(n, .7, 'sine', .14, i * .1)); break;
        case 'trap': this.tone(180, .8, 'triangle', .17, 0, 720); this.tone(600, .7, 'sine', .12, .15, 300); this.noise(.3, .08, 1400); break;
        case 'attack': this.tone(340, .3, 'sawtooth', .09, 0, 60); this.noise(.35, .2, 3500); break;
        case 'damage': this.tone(95, .45, 'sine', .28, 0, 35); this.noise(.4, .17, 1000); break;
        case 'phase': this.tone(392, .25, 'sine', .12); this.tone(587.33, .4, 'sine', .1, .1); break;
        case 'victory': [261.63, 329.63, 392, 523.25, 659.25, 783.99].forEach((n, i) => this.tone(n, 1.8, 'triangle', .14, i * .12)); break;
        case 'defeat': [293.66, 261.63, 220, 146.83].forEach((n, i) => this.tone(n, 1.4, 'triangle', .1, i * .23)); break;
      }
    }
    playMusic() {
      if (document.hidden || !this.prefs.music || !this.prefs.sound) return;
      const chords = [[146.83, 220, 293.66, 349.23], [130.81, 196, 261.63, 329.63], [116.54, 174.61, 233.08, 293.66], [130.81, 196, 261.63, 392]];
      const chord = chords[this.musicStep++ % chords.length];
      chord.forEach((note, i) => { this.tone(note, 5.8, 'sine', .035, i * .13); this.tone(note * 2, 2.7, 'sine', .025, .8 + i * .65); });
    }
  }
  root.DuelAudio = DuelAudio;
})(window);
