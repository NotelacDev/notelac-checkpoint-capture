import { asyncStorage, createStore } from './createStore';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Trigger = 'motion' | 'interval' | 'manual';
export type Sensitivity = 'low' | 'medium' | 'high';
export type VideoQuality = '720p' | '1080p' | '2160p';

export type Settings = {
  themeMode: ThemeMode;
  operator: string | null;
  checkpointId: string | null;

  // Camera & capture
  facing: 'back' | 'front';
  videoQuality: VideoQuality;
  photoQuality: number; // 0..1 JPEG quality
  burstFrames: number;
  trigger: Trigger;
  intervalSec: number;
  sensitivity: Sensitivity;
  videoSegmentMin: number;
  keepAwake: boolean;
  haptics: boolean;
  shutterSound: boolean;

  // Timestamp overlay
  overlay: boolean;
  overlayMs: boolean;
  overlayGps: boolean;

  // Upload & storage
  apiUrl: string; // empty = demo mode (uploads are simulated)
  apiToken: string;
  wifiOnly: boolean;
  autoRetry: boolean;
  keepLocal: boolean;
  uploadsPaused: boolean;
};

export const defaultSettings: Settings = {
  themeMode: 'system',
  operator: null,
  checkpointId: null,
  facing: 'back',
  videoQuality: '1080p',
  photoQuality: 0.85,
  burstFrames: 5,
  trigger: 'motion',
  intervalSec: 5,
  sensitivity: 'medium',
  videoSegmentMin: 10,
  keepAwake: true,
  haptics: true,
  shutterSound: false,
  overlay: true,
  overlayMs: true,
  overlayGps: true,
  apiUrl: '',
  apiToken: '',
  wifiOnly: false,
  autoRetry: true,
  keepLocal: true,
  uploadsPaused: false,
};

export const settingsStore = createStore<Settings>(defaultSettings, asyncStorage('notelac.settings.v1'));

export const useSettings = <S>(sel: (s: Settings) => S) => settingsStore.use(sel);
export const setSettings = settingsStore.set;
