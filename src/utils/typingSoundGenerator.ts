interface TypingSoundOptions {
  volume?: number;
  enabled?: boolean;
}

export class TypingSoundGenerator {
  private audioContext: AudioContext | null = null;
  private enabled: boolean = true;
  private volume: number = 0.3;

  constructor(options?: TypingSoundOptions) {
    if (options?.enabled !== undefined) {
      this.enabled = options.enabled;
    }
    if (options?.volume !== undefined) {
      this.volume = Math.max(0, Math.min(1, options.volume));
    }
    // 기본 볼륨을 더 낮게 설정
    this.volume = 0.15;
  }

  private ensureAudioContext(): AudioContext {
    if (!this.audioContext) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioContextClass();
    }
    return this.audioContext;
  }

  public playMechanicalKey(): void {
    if (!this.enabled) return;

    try {
      const context = this.ensureAudioContext();
      const now = context.currentTime;

      // 기본 주파수를 더 낮게 설정 (저음)
      const baseFreq = 1200;
      const freqVariation = (Math.random() - 0.5) * 120; // ±5% variation
      const frequency = baseFreq + freqVariation;

      // 볼륨 변화를 더 작게 설정
      const volumeVariation = 0.8 + Math.random() * 0.2; // 0.8 to 1.0
      const volume = this.volume * volumeVariation;

      // 메인 톤 생성
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      const filter = context.createBiquadFilter();

      // 오실레이터 설정 (타자기 느낌)
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(frequency, now);

      // 필터 설정 (타자기 느낌)
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(frequency * 0.8, now);
      filter.Q.setValueAtTime(0.8, now);

      // 게인 설정 (타자기 느낌 - 더 날카롭고 짧게)
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(volume * 0.7, now + 0.001); // 1ms attack
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.01); // 10ms sustain
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.05); // 50ms decay

      // 연결
      oscillator.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(context.destination);

      // 재생 및 정리
      oscillator.start(now);
      oscillator.stop(now + 0.15);

      // 노이즈 요소 추가 (타자기 느낌)
      this.addNoiseComponent(context, now, volume * 0.12);
    } catch (error) {
      console.warn('Typing sound generation failed:', error);
    }
  }

  private addNoiseComponent(context: AudioContext, startTime: number, volume: number): void {
    try {
      const bufferSize = context.sampleRate * 0.008; // 8ms of noise - 더 짧게
      const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() - 0.5) * 2;
      }

      const noiseSource = context.createBufferSource();
      const noiseGain = context.createGain();
      const noiseFilter = context.createBiquadFilter();

      noiseSource.buffer = buffer;

      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1500, startTime);
      noiseFilter.Q.setValueAtTime(1.2, startTime);

      noiseGain.gain.setValueAtTime(volume, startTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.015);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(context.destination);

      noiseSource.start(startTime);
    } catch (error) {
      // 노이즈 추가 실패는 무시
    }
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  public getEnabled(): boolean {
    return this.enabled;
  }

  public getVolume(): number {
    return this.volume;
  }

  public dispose(): void {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.audioContext = null;
  }
}

// 싱글톤 인스턴스
let typingSoundGenerator: TypingSoundGenerator | null = null;

export const getTypingSoundGenerator = (): TypingSoundGenerator => {
  if (!typingSoundGenerator) {
    typingSoundGenerator = new TypingSoundGenerator();
  }
  return typingSoundGenerator;
};

export const disposeTypingSoundGenerator = (): void => {
  if (typingSoundGenerator) {
    typingSoundGenerator.dispose();
    typingSoundGenerator = null;
  }
};