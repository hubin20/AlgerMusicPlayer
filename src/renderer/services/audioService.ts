import { Howl, Howler } from 'howler';

import type { SongResult } from '@/type/music';
import { isElectron } from '@/utils'; // 导入isElectron常量

class AudioService {
  private currentSound: Howl | null = null;

  private currentTrack: SongResult | null = null;

  private context: AudioContext | null = null;

  private filters: BiquadFilterNode[] = [];

  private source: MediaElementAudioSourceNode | null = null;

  private gainNode: GainNode | null = null;

  private bypass = false;

  private playbackRate = 1.0; // 添加播放速度属性

  // 预设的 EQ 频段
  private readonly frequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

  // 默认的 EQ 设置
  private defaultEQSettings: { [key: string]: number } = {
    '31': 0,
    '62': 0,
    '125': 0,
    '250': 0,
    '500': 0,
    '1000': 0,
    '2000': 0,
    '4000': 0,
    '8000': 0,
    '16000': 0
  };

  private retryCount = 0;

  private seekLock = false;

  private seekDebounceTimer: NodeJS.Timeout | null = null;

  // 添加操作锁防止并发操作
  private operationLock = false;
  private operationLockTimer: NodeJS.Timeout | null = null;
  private operationLockTimeout = 5000; // 5秒超时
  private operationLockStartTime: number = 0;
  private operationLockId: string = ''; // 用于追踪当前锁的持有者
  private lockAcquisitionAttempts: Record<string, number> = {}; // 记录锁获取尝试

  constructor() {
    if ('mediaSession' in navigator) {
      this.initMediaSession();
    }
    // 从本地存储加载 EQ 开关状态
    const bypassState = localStorage.getItem('eqBypass');
    this.bypass = bypassState ? JSON.parse(bypassState) : false;

    // 页面加载时立即强制重置操作锁
    this.forceResetOperationLock();

    // 添加页面卸载事件，确保离开页面时清除锁
    window.addEventListener('beforeunload', () => {
      this.forceResetOperationLock();
    });
  }

  private initMediaSession() {
    navigator.mediaSession.setActionHandler('play', () => {
      this.currentSound?.play();
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      this.currentSound?.pause();
    });

    navigator.mediaSession.setActionHandler('stop', () => {
      this.stop();
    });

    navigator.mediaSession.setActionHandler('seekto', (event) => {
      if (event.seekTime && this.currentSound) {
        // this.currentSound.seek(event.seekTime);
        this.seek(event.seekTime);
      }
    });

    navigator.mediaSession.setActionHandler('seekbackward', (event) => {
      if (this.currentSound) {
        const currentTime = this.currentSound.seek() as number;
        this.seek(currentTime - (event.seekOffset || 10));
      }
    });

    navigator.mediaSession.setActionHandler('seekforward', (event) => {
      if (this.currentSound) {
        const currentTime = this.currentSound.seek() as number;
        this.seek(currentTime + (event.seekOffset || 10));
      }
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      // 这里需要通过回调通知外部
      this.emit('previoustrack');
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      // 这里需要通过回调通知外部
      this.emit('nexttrack');
    });
  }

  private updateMediaSessionMetadata(track: SongResult) {
    if (!('mediaSession' in navigator)) return;

    const artists = track.ar ? track.ar.map((a) => a.name) : track.song.artists?.map((a) => a.name);
    const album = track.al ? track.al.name : track.song.album.name;
    const artwork = ['96', '128', '192', '256', '384', '512'].map((size) => ({
      src: `${track.picUrl}?param=${size}y${size}`,
      type: 'image/jpg',
      sizes: `${size}x${size}`
    }));
    const metadata = {
      title: track.name || '',
      artist: artists ? artists.join(',') : '',
      album: album || '',
      artwork
    };

    navigator.mediaSession.metadata = new window.MediaMetadata(metadata);
  }

  private updateMediaSessionState(isPlaying: boolean) {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    this.updateMediaSessionPositionState();
  }

  private updateMediaSessionPositionState() {
    if (!this.currentSound || !('mediaSession' in navigator)) return;

    if ('setPositionState' in navigator.mediaSession) {
      navigator.mediaSession.setPositionState({
        duration: this.currentSound.duration(),
        playbackRate: this.playbackRate,
        position: this.currentSound.seek() as number
      });
    }
  }

  // 事件处理相关
  private callbacks: { [key: string]: Function[] } = {};

  private emit(event: string, ...args: any[]) {
    const eventCallbacks = this.callbacks[event];
    if (eventCallbacks) {
      eventCallbacks.forEach((callback) => callback(...args));
    }
  }

  on(event: string, callback: Function) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }

  off(event: string, callback: Function) {
    const eventCallbacks = this.callbacks[event];
    if (eventCallbacks) {
      this.callbacks[event] = eventCallbacks.filter((cb) => cb !== callback);
    }
  }

  // EQ 相关方法
  public isEQEnabled(): boolean {
    return !this.bypass;
  }

  public setEQEnabled(enabled: boolean) {
    this.bypass = !enabled;
    localStorage.setItem('eqBypass', JSON.stringify(this.bypass));

    if (this.source && this.gainNode && this.context) {
      this.applyBypassState();
    }
  }

  public setEQFrequencyGain(frequency: string, gain: number) {
    const filterIndex = this.frequencies.findIndex((f) => f.toString() === frequency);
    if (filterIndex !== -1 && this.filters[filterIndex]) {
      this.filters[filterIndex].gain.setValueAtTime(gain, this.context?.currentTime || 0);
      this.saveEQSettings(frequency, gain);
    }
  }

  public resetEQ() {
    this.filters.forEach((filter) => {
      filter.gain.setValueAtTime(0, this.context?.currentTime || 0);
    });
    localStorage.removeItem('eqSettings');
  }

  public getAllEQSettings(): { [key: string]: number } {
    return this.loadEQSettings();
  }

  private saveEQSettings(frequency: string, gain: number) {
    const settings = this.loadEQSettings();
    settings[frequency] = gain;
    localStorage.setItem('eqSettings', JSON.stringify(settings));
  }

  private loadEQSettings(): { [key: string]: number } {
    const savedSettings = localStorage.getItem('eqSettings');
    return savedSettings ? JSON.parse(savedSettings) : { ...this.defaultEQSettings };
  }

  private async disposeEQ(keepContext = false) {
    try {
      // 清理音频节点连接
      if (this.source) {
        this.source.disconnect();
        this.source = null;
      }

      // 清理滤波器
      this.filters.forEach((filter) => {
        try {
          filter.disconnect();
        } catch (e) {
          console.warn('清理滤波器时出错:', e);
        }
      });
      this.filters = [];

      // 清理增益节点
      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }

      // 如果不需要保持上下文，则关闭它
      if (!keepContext && this.context) {
        try {
          await this.context.close();
          console.log('[AudioService] AudioContext closed.');
        } catch (e) {
          console.warn('[AudioService] Error closing AudioContext:', e);
        }
        this.context = null;
      }
    } catch (error) {
      console.error('清理EQ资源时出错:', error);
    }
  }

  private async setupEQ(sound: Howl) {
    try {
      if (!isElectron) {
        console.log('Web环境中跳过EQ设置，避免CORS问题');
        this.bypass = true;
        return;
      }
      const howl = sound as any;
      // eslint-disable-next-line no-underscore-dangle
      const audioNode = howl._sounds?.[0]?._node;

      if (!audioNode || !(audioNode instanceof HTMLMediaElement)) {
        if (this.retryCount < 3) {
          console.warn('等待音频节点初始化，重试次数:', this.retryCount + 1);
          await new Promise((resolve) => setTimeout(resolve, 100));
          this.retryCount++;
          return await this.setupEQ(sound);
        }
        throw new Error('无法获取音频节点，请重试');
      }

      this.retryCount = 0;

      // 确保使用 Howler 的音频上下文
      this.context = Howler.ctx as AudioContext;

      if (!this.context || this.context.state === 'closed') {
        Howler.ctx = new AudioContext();
        this.context = Howler.ctx;
        Howler.masterGain = this.context.createGain();
        Howler.masterGain.connect(this.context.destination);
      }

      if (this.context.state === 'suspended') {
        await this.context.resume();
      }

      // 清理现有连接
      await this.disposeEQ(true);

      try {
        // 检查节点是否已经有源
        const existingSource = (audioNode as any).source as MediaElementAudioSourceNode;
        if (existingSource?.context === this.context) {
          console.log('复用现有音频源节点');
          this.source = existingSource;
        } else {
          // 创建新的源节点
          console.log('创建新的音频源节点');
          this.source = this.context.createMediaElementSource(audioNode);
          (audioNode as any).source = this.source;
        }
      } catch (e) {
        console.error('创建音频源节点失败:', e);
        throw e;
      }

      // 创建增益节点
      this.gainNode = this.context.createGain();

      // 创建滤波器
      this.filters = this.frequencies.map((freq) => {
        const filter = this.context!.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = freq;
        filter.Q.value = 1;
        filter.gain.value = this.loadEQSettings()[freq.toString()] || 0;
        return filter;
      });

      // 应用EQ状态
      this.applyBypassState();

      // 设置音量
      const volume = localStorage.getItem('volume');
      if (this.gainNode) {
        this.gainNode.gain.value = volume ? parseFloat(volume) : 1;
      }

      console.log('EQ初始化成功');
    } catch (error) {
      console.error('EQ初始化失败:', error);
      await this.disposeEQ();
      throw error;
    }
  }

  private applyBypassState() {
    if (!this.source || !this.gainNode || !this.context) return;

    try {
      // 断开所有现有连接
      this.source.disconnect();
      this.filters.forEach((filter) => filter.disconnect());
      this.gainNode.disconnect();

      if (this.bypass) {
        // EQ被禁用时，直接连接到输出
        this.source.connect(this.gainNode);
        this.gainNode.connect(this.context.destination);
      } else {
        // EQ启用时，通过滤波器链连接
        this.source.connect(this.filters[0]);
        this.filters.forEach((filter, index) => {
          if (index < this.filters.length - 1) {
            filter.connect(this.filters[index + 1]);
          }
        });
        this.filters[this.filters.length - 1].connect(this.gainNode);
        this.gainNode.connect(this.context.destination);
      }
    } catch (error) {
      console.error('应用EQ状态时出错:', error);
    }
  }

  // 设置操作锁，带超时自动释放
  private setOperationLock(operationId: string): boolean {
    const newLockId = operationId + '_' + Date.now(); // 为每次尝试获取锁生成唯一ID
    console.log(`[AudioService setOperationLock] Attempting to acquire lock. Current Lock ID: ${this.operationLockId}, New Attempt ID: ${newLockId}, Locked: ${this.operationLock}`);
    this.lockAcquisitionAttempts[newLockId] = (this.lockAcquisitionAttempts[newLockId] || 0) + 1;

    if (this.operationLock) {
      const timeSinceLock = Date.now() - this.operationLockStartTime;
      console.warn(
        `[AudioService setOperationLock] Failed to acquire lock (ID: ${newLockId}). Operation already in progress by Lock ID: ${this.operationLockId}. Locked for ${timeSinceLock}ms. Attempt #${this.lockAcquisitionAttempts[newLockId]}`
      );
      if (timeSinceLock > this.operationLockTimeout) {
        console.error(
          `[AudioService setOperationLock] Previous operation (Lock ID: ${this.operationLockId}) exceeded timeout (${this.operationLockTimeout}ms). Forcing lock reset.`
        );
        this.forceResetOperationLock(); // 强制重置
        // 再次尝试获取锁
        this.operationLock = true;
        this.operationLockId = newLockId; // 使用新的唯一ID
        this.operationLockStartTime = Date.now();
        console.log(`[AudioService setOperationLock] Lock acquired by force (New Lock ID: ${this.operationLockId}) after previous timeout.`);
        // 清除旧的定时器，启动新的
        if (this.operationLockTimer) clearTimeout(this.operationLockTimer);
        this.operationLockTimer = setTimeout(() => {
          if (this.operationLock && this.operationLockId === newLockId) { // 确保是当前锁超时
            console.error(
              `[AudioService setOperationLock] Lock (ID: ${this.operationLockId}) timed out after forced acquisition. Releasing.`
            );
            this.releaseOperationLock(newLockId, 'timeout_after_force');
          }
        }, this.operationLockTimeout);
        return true;
      }
      return false;
    }
    this.operationLock = true;
    this.operationLockId = newLockId; // 使用新的唯一ID
    this.operationLockStartTime = Date.now();
    console.log(`[AudioService setOperationLock] Lock acquired (New Lock ID: ${this.operationLockId}). Attempt #${this.lockAcquisitionAttempts[newLockId]}`);
    if (this.operationLockTimer) clearTimeout(this.operationLockTimer); // 清除可能存在的旧计时器
    this.operationLockTimer = setTimeout(() => {
      if (this.operationLock && this.operationLockId === newLockId) { // 确保是当前锁超时
        console.error(
          `[AudioService setOperationLock] Lock (ID: ${this.operationLockId}) timed out. Releasing. Operation: ${operationId}`
        );
        // 主动释放锁，并传递原始的 operationId 或 newLockId
        this.releaseOperationLock(newLockId, 'timeout');
      }
    }, this.operationLockTimeout);
    return true;
  }

  // 释放操作锁
  public releaseOperationLock(callerLockId?: string, reason?: string): void {
    // 只有当传入的 callerLockId 与当前持有的 operationLockId 匹配，或者没有传入 callerLockId (允许无条件释放，需谨慎)
    // 或者是一个特殊的强制释放信号（例如 reason === 'force_reset'）时才释放
    if (this.operationLockId && callerLockId && this.operationLockId !== callerLockId) {
      console.warn(`[AudioService releaseOperationLock] Attempt to release lock with mismatched ID. Current Lock ID: ${this.operationLockId}, Caller Lock ID: ${callerLockId}. Reason: ${reason || 'N/A'}. Lock not released by this call.`);
      return;
    }

    if (this.operationLockTimer) {
      clearTimeout(this.operationLockTimer);
      this.operationLockTimer = null;
    }
    const releasedLockId = this.operationLockId; // 保存被释放的锁ID
    this.operationLock = false;
    this.operationLockId = ''; // 清空锁ID
    this.operationLockStartTime = 0;
    // 清理这个 specific lock ID 的获取尝试次数记录
    if (callerLockId && this.lockAcquisitionAttempts[callerLockId]) {
      delete this.lockAcquisitionAttempts[callerLockId];
    } else if (releasedLockId && this.lockAcquisitionAttempts[releasedLockId]) {
      // 如果没有 callerLockId 但成功释放了当前的锁，也尝试清理
      delete this.lockAcquisitionAttempts[releasedLockId];
    }

    console.log(`[AudioService releaseOperationLock] Lock released. Released Lock ID: ${releasedLockId}. Triggered by Lock ID: ${callerLockId || 'N/A'}. Reason: ${reason || 'N/A'}`);
  }

  // 强制重置操作锁，用于特殊情况
  public forceResetOperationLock(): void {
    if (this.operationLockTimer) {
      clearTimeout(this.operationLockTimer);
      this.operationLockTimer = null;
    }
    const previousLockId = this.operationLockId;
    this.operationLock = false;
    this.operationLockId = '';
    this.operationLockStartTime = 0;
    this.lockAcquisitionAttempts = {}; // 清空所有尝试记录
    console.warn(`[AudioService forceResetOperationLock] Operation lock forcefully reset. Previous Lock ID: ${previousLockId || 'N/A'}`);
    // 在这里可以添加一个事件发射，通知外部锁已被强制重置，如果外部逻辑需要感知的话
    this.emit('operationLockForceReset', previousLockId);
  }

  // 播放控制相关
  play(url?: string, track?: SongResult, isPlay: boolean = true): Promise<Howl> {
    const operationId = track ? `play-${track.name}` : `play-${url ? url.substring(0, 30) : 'unknown'}`;
    // 尝试获取操作锁
    if (!this.setOperationLock(operationId)) {
      const errorMessage = `[AudioService Play] Could not acquire operation lock for playing: ${track?.name || url}. Operation already in progress by lock ID: ${this.operationLockId}`;
      console.error(errorMessage);
      this.emit('error', {
        message: i18n.global.t('message.musicIsLoading'),
        type: 'play',
        track,
        details: `Operation lock busy by: ${this.operationLockId}`
      });
      return Promise.reject(new Error(errorMessage));
    }

    // 保留当前锁的ID，用于后续释放
    const acquiredLockId = this.operationLockId;

    console.log(`[AudioService Play] Lock acquired (${acquiredLockId}) for track:`, track?.name, 'URL:', url);
    this.retryCount = 0; // 重置重试计数器

    return new Promise<Howl>((resolve, reject) => {
      let retryCount = 0;
      const maxRetries = 1;

      const tryPlay = async () => {
        try {
          console.log('audioService: 开始创建音频对象');

          // 确保 Howler 上下文已初始化
          if (!Howler.ctx) {
            console.log('audioService: 初始化 Howler 上下文');
            Howler.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          }

          // 确保使用同一个音频上下文
          if (Howler.ctx.state === 'closed') {
            console.log('audioService: 重新创建音频上下文');
            Howler.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.context = Howler.ctx;
            Howler.masterGain = this.context.createGain();
            Howler.masterGain.connect(this.context.destination);
          }

          // 恢复上下文状态
          if (Howler.ctx.state === 'suspended') {
            console.log('audioService: 恢复暂停的音频上下文');
            await Howler.ctx.resume();
          }

          // 先停止并清理现有的音频实例
          if (this.currentSound) {
            console.log('audioService: 停止并清理现有的音频实例');
            // 确保任何进行中的seek操作被取消
            if (this.seekLock && this.seekDebounceTimer) {
              clearTimeout(this.seekDebounceTimer);
              this.seekLock = false;
            }
            this.currentSound.stop();
            this.currentSound.unload();
            this.currentSound = null;
          }

          // 清理 EQ 但保持上下文
          console.log('audioService: 清理 EQ');
          await this.disposeEQ(true);

          this.currentTrack = track;
          console.log('audioService: 创建新的 Howl 对象');
          this.currentSound = new Howl({
            src: [url],
            html5: true,
            autoplay: false, // 修改为 false，不自动播放，等待完全初始化后手动播放
            volume: localStorage.getItem('volume')
              ? parseFloat(localStorage.getItem('volume') as string)
              : 1,
            rate: this.playbackRate, // 设置初始播放速度
            format: ['mp3', 'aac'],
            onloaderror: (_, error) => {
              console.error('Audio load error:', error);
              if (retryCount < maxRetries) {
                retryCount++;
                console.log(`Retrying playback (${retryCount}/${maxRetries})...`);
                setTimeout(tryPlay, 1000 * retryCount);
              } else {
                // 发送URL过期事件，通知外部需要重新获取URL
                this.emit('url_expired', this.currentTrack);
                this.releaseOperationLock(acquiredLockId, 'onloaderror');
                reject(new Error('音频加载失败，请尝试切换其他歌曲'));
              }
            },
            onplayerror: (_, error) => {
              console.error('Audio play error:', error);
              if (retryCount < maxRetries) {
                retryCount++;
                console.log(`Retrying playback (${retryCount}/${maxRetries})...`);
                setTimeout(tryPlay, 1000 * retryCount);
              } else {
                // 发送URL过期事件，通知外部需要重新获取URL
                this.emit('url_expired', this.currentTrack);
                this.releaseOperationLock(acquiredLockId, 'onplayerror');
                reject(new Error('音频播放失败，请尝试切换其他歌曲'));
              }
            },
            onload: async () => {
              // 音频加载成功后设置 EQ 和更新媒体会话
              if (this.currentSound) {
                try {
                  console.log('audioService: 音频加载成功，设置 EQ');
                  await this.setupEQ(this.currentSound);
                  this.updateMediaSessionMetadata(track);
                  this.updateMediaSessionPositionState();
                  this.emit('load');

                  // 此时音频已完全初始化，根据 isPlay 参数决定是否播放
                  console.log('audioService: 音频完全初始化，isPlay =', isPlay);
                  if (isPlay) {
                    console.log('audioService: 开始播放');
                    this.currentSound.play();
                  }

                  resolve(this.currentSound);
                } catch (error) {
                  console.error('设置 EQ 失败:', error);
                  // 即使 EQ 设置失败，也继续播放（如果需要）
                  if (isPlay) {
                    this.currentSound.play();
                  }
                  resolve(this.currentSound);
                }
              }
            }
          });

          // 设置音频事件监听
          if (this.currentSound) {
            this.currentSound.on('play', () => {
              this.updateMediaSessionState(true);
              this.emit('play');
            });

            this.currentSound.on('pause', () => {
              this.updateMediaSessionState(false);
              this.emit('pause');
            });

            this.currentSound.on('end', () => {
              this.emit('end');
            });

            this.currentSound.on('seek', () => {
              this.updateMediaSessionPositionState();
              this.emit('seek');
            });
          }
        } catch (error) {
          console.error('Error creating audio instance:', error);
          this.releaseOperationLock(acquiredLockId, 'error_creating_instance');
          reject(error);
        }
      };

      tryPlay();
    }).finally(() => {
      // 无论成功或失败都解除操作锁
      this.releaseOperationLock(acquiredLockId, 'play_completed');
    });
  }

  getCurrentSound() {
    return this.currentSound;
  }

  getCurrentTrack() {
    return this.currentTrack;
  }

  stop(keepEQSetup = false) {
    const operationId = `stop-${this.currentTrack?.name || 'current'}`;
    if (!this.setOperationLock(operationId)) {
      console.warn(`[AudioService Stop] Could not acquire lock for stopping. Operation: ${this.operationLockId} in progress.`);
      // 通常stop操作即使未获得锁也应该尝试执行，或者至少标记需要停止
      // 但为了避免状态混乱，如果严格要求锁，可以提前返回
      // return; 
    }
    const acquiredLockId = this.operationLockId;
    console.log(`[AudioService Stop] Lock acquired (${acquiredLockId}) for stop operation.`);

    if (this.currentSound) {
      console.log(`[AudioService Stop] Stopping track: ${this.currentTrack?.name}`);
      this.currentSound.stop(); // Howler's stop will trigger 'onstop'
      // Unload should happen after onstop or if explicitly clearing
      // this.currentSound.unload(); // Moved to a more controlled place or ensure 'onstop' handles it.
      if (!keepEQSetup) {
        this.disposeEQ(); // 停止时通常也清理EQ，除非特殊说明
      }
    }
    // 无论如何，stop操作完成后应该释放锁
    this.releaseOperationLock(acquiredLockId, 'stop_completed');
    // this.currentTrack = null; // 清理当前轨道信息应在更高层处理
  }

  setVolume(volume: number) {
    if (this.currentSound) {
      this.currentSound.volume(volume);
      localStorage.setItem('volume', volume.toString());
    }
  }

  seek(time: number) {
    const operationId = `seek-${this.currentTrack?.name || 'current'}-${time}`;
    if (!this.setOperationLock(operationId)) {
      console.warn(`[AudioService Seek] Could not acquire lock for seeking. Operation: ${this.operationLockId} in progress.`);
      return; // Seek操作通常可以被跳过如果锁被占用
    }
    const acquiredLockId = this.operationLockId;
    console.log(`[AudioService Seek] Lock acquired (${acquiredLockId}) for seek operation.`);

    if (this.currentSound && this.currentSound.state() === 'loaded') {
      if (this.seekDebounceTimer) {
        clearTimeout(this.seekDebounceTimer);
      }
      this.seekDebounceTimer = setTimeout(() => {
        if (this.currentSound && this.currentSound.duration() > 0) {
          const newTime = Math.max(0, Math.min(time, this.currentSound.duration()));
          console.log(`[AudioService Seek] Seeking to: ${newTime} for track ${this.currentTrack?.name}`);
          this.currentSound.seek(newTime);
          // Howler's seek will trigger 'onseek'
        } else {
          console.warn(`[AudioService Seek] Cannot seek. Sound not ready or duration is 0. Track: ${this.currentTrack?.name}`);
        }
        this.seekLock = false;
        this.releaseOperationLock(acquiredLockId, 'seek_debounced'); // 防抖后执行完seek，释放锁
      }, 300); // 300ms 防抖
    } else {
      console.warn(`[AudioService Seek] Cannot seek. Sound not loaded. Track: ${this.currentTrack?.name}`);
      this.releaseOperationLock(acquiredLockId, 'seek_sound_not_loaded'); // 未能seek，也要释放锁
    }
  }

  pause() {
    // Pause操作通常比较轻量，可以不严格要求锁，或者使用一个更短的超时/特定类型的锁
    // 但为了统一，这里还是尝试获取锁
    const operationId = `pause-${this.currentTrack?.name || 'current'}`;
    if (!this.setOperationLock(operationId)) {
      console.warn(`[AudioService Pause] Could not acquire lock for pausing. Operation: ${this.operationLockId} in progress.`);
      // 如果获取不到锁，是否强行暂停？取决于业务需求
      // if (this.currentSound?.playing()) this.currentSound.pause();
      return;
    }
    const acquiredLockId = this.operationLockId;
    console.log(`[AudioService Pause] Lock acquired (${acquiredLockId}) for pause operation.`);

    if (this.currentSound && this.currentSound.playing()) {
      console.log(`[AudioService Pause] Pausing track: ${this.currentTrack?.name}`);
      this.currentSound.pause(); // Howler's pause will trigger 'onpause'
    }
    // pause 操作完成后也应该释放锁
    this.releaseOperationLock(acquiredLockId, 'pause_completed');
  }

  clearAllListeners() {
    this.callbacks = {};
  }

  public getCurrentPreset(): string | null {
    return localStorage.getItem('currentPreset');
  }

  public setCurrentPreset(preset: string): void {
    localStorage.setItem('currentPreset', preset);
  }

  public setPlaybackRate(rate: number) {
    if (!this.currentSound) return;
    this.playbackRate = rate;

    // Howler 的 rate() 在 html5 模式下不生效
    this.currentSound.rate(rate);

    // 取出底层 HTMLAudioElement，改原生 playbackRate
    const sounds = (this.currentSound as any)._sounds as any[];
    sounds.forEach(({ _node }) => {
      if (_node instanceof HTMLAudioElement) {
        _node.playbackRate = rate;
      }
    });

    // 同步给 Media Session UI
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
      navigator.mediaSession.setPositionState({
        duration: this.currentSound.duration(),
        playbackRate: rate,
        position: this.currentSound.seek() as number
      });
    }
  }

  public getPlaybackRate(): number {
    return this.playbackRate;
  }
}

export const audioService = new AudioService();
