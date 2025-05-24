import { cloneDeep } from 'lodash';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

import i18n from '@/../i18n/renderer';
import { getLikedList, getMusicLrc, getMusicUrl, getParsingMusicUrl, likeSong } from '@/api/music';
import { getKwMusicPlayUrl, getKwMusicLyric } from '@/api/kwmusic';
import { useMusicHistory } from '@/hooks/MusicHistoryHook';
import { audioService } from '@/services/audioService';
import type { ILyric, ILyricText, SongResult } from '@/type/music';
import { getImgUrl } from '@/utils';
import { getImageLinearBackground } from '@/utils/linearColor';
import { createDiscreteApi } from 'naive-ui';

import { useSettingsStore } from './settings';
import { useUserStore } from './user';
import { type Platform } from '@/types/music';

const musicHistory = useMusicHistory();
const { message } = createDiscreteApi(['message']);

const preloadingSounds = ref<Howl[]>([]);

function getLocalStorageItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * 获取歌曲的播放URL，针对网易云音源采用竞速模式获取链接。
 * 
 * @param id 歌曲ID
 * @param songData 歌曲的元数据对象，包含source, name, playMusicUrl, bilibiliData等
 * @param isDownloaded 是否为下载场景，如果是，则期望返回包含完整信息的对象而非仅URL字符串
 * @returns 返回歌曲的播放URL字符串，或者在下载场景下返回包含URL和其他信息的对象。获取失败则返回空字符串。
 */
export const getSongUrl = async (
  id: string | number,
  songData: SongResult,
  isDownloaded: boolean = false
): Promise<string | Record<string, any>> => {
  console.log('[PlayerStore GetSongUrl] Entry. ID:', id, 'Source:', songData.source, 'SongName:', songData.name);

  // 优先处理其他源 (如 'other' 代表的酷我)
  if (songData.source === 'other') {
    console.log('[PlayerStore GetSongUrl] Other (KW) Branch. Quality:', 'exhigh');
    try {
      const quality = 'exhigh'; // Or map from settings
      // @ts-ignore
      songData.playMusicUrl = await getKwMusicPlayUrl(songData.id as number, quality);
      console.log('[PlayerStore GetSongUrl] KW URL Fetched:', songData.playMusicUrl);
      return songData.playMusicUrl || '';
    } catch (error) {
      console.error('[PlayerStore GetSongUrl] KW Error fetching URL:', error);
      return '';
    }
  }

  // 如果已有播放链接 (且非B站未验证URL的情况)，直接返回
  if (songData.playMusicUrl) {
    console.log('[PlayerStore GetSongUrl] Has existing playMusicUrl:', songData.playMusicUrl);
    return songData.playMusicUrl;
  }

  // 网易云处理 (source === 'netease' or undefined)
  if (songData.source === 'netease' || songData.source === undefined) {
    console.log('[PlayerStore GetSongUrl] Netease/Default Branch. ID:', id);
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    const settingsStore = useSettingsStore();
    const unblockEnabled = settingsStore.setData.enableMusicUnblock === true;

    let officialUrl: string | null = null;
    let officialSongInfo: any = null; // Store the full song info from official API

    // --- Step 1: Try Official API First ---
    console.log('[PlayerStore GetSongUrl] Netease: Step 1 - Attempting Official API (getMusicUrl)');
    try {
      // 注意：getMusicUrl 内部可能已有超时和重试，这里的 try-catch 主要处理其最终结果
      const { data: neteaseApiData } = await getMusicUrl(numericId, isDownloaded);
      if (neteaseApiData?.data?.[0]?.url) {
        officialSongInfo = neteaseApiData.data[0];
        officialUrl = officialSongInfo.url;
        console.log('[PlayerStore GetSongUrl] Netease: Official API success. URL:', officialUrl, 'SongInfo:', JSON.stringify(officialSongInfo));

        // --- Refined check for VIP/Trial/Unavailable ---
        let needsUnblock = false;
        const song = officialSongInfo;

        // 场景1: fee 为 1 (VIP歌曲) 或 4 (付费专辑)
        if (song.fee === 1 || song.fee === 4) {
          if (!song.freeTrialInfo && (!song.br || song.br <= 0)) {
            // 没有试听信息，并且码率无效或为0 (表示无法直接播放)
            needsUnblock = true;
            console.log('[PlayerStore GetSongUrl] Netease: Marked for unblock (VIP/Purchased, no trial, invalid br). Info:', JSON.stringify({ fee: song.fee, br: song.br, freeTrialInfo: !!song.freeTrialInfo }));
          } else if (song.freeTrialInfo) {
            // 有试听信息，也认为需要解灰以获取完整版
            needsUnblock = true;
            console.log('[PlayerStore GetSongUrl] Netease: Official URL is trial. Marked for unblock. Info:', JSON.stringify({ freeTrialInfo: song.freeTrialInfo }));
          }
        } else if ((!song.br || song.br <= 0) && song.fee === 0 && !song.freeTrialInfo) {
          // 免费歌曲 (fee=0)，但码率无效 (通常意味着灰色，无版权)
          // 并且没有试听信息 (有些灰色曲目可能有试听片段，但我们目标是可播放的)
          // (song.privileges?.pl > 0 && song.privileges?.playMaxbr === 0) // 另一个可能的判断条件
          needsUnblock = true;
          console.log('[PlayerStore GetSongUrl] Netease: Marked for unblock (Free song, but invalid br - likely grey/no copyright). Info:', JSON.stringify({ fee: song.fee, br: song.br }));
        }
        // 更多精细化判断可以加入，比如基于 song.privileges 对象中的具体权限

        if (needsUnblock) {
          console.log('[PlayerStore GetSongUrl] Netease: Official URL determined to need unblocking.');
          if (unblockEnabled) {
            console.log('[PlayerStore GetSongUrl] Netease: Proceeding to unblock service.');
            // Fall through to unblock service section
          } else {
            console.log('[PlayerStore GetSongUrl] Netease: Unblock service disabled. Cannot play/unblock this song.');
            // 如果下载，返回包含错误信息的对象；否则返回空，上层处理播放失败
            // 可以考虑返回 officialUrl，让用户知道至少有个（可能无法播放的）链接
            return isDownloaded ? { error: 'Song needs unblock, but service disabled', id: numericId, officialSongInfo } : (officialUrl || '');
          }
        } else {
          // Official URL seems directly playable
          console.log('[PlayerStore GetSongUrl] Netease: Official URL is directly usable:', officialUrl);
          return isDownloaded ? (officialSongInfo || { url: officialUrl, id: numericId }) : officialUrl;
        }
      } else {
        console.warn('[PlayerStore GetSongUrl] Netease: No URL in official API response data. Will try unblock if enabled.');
        // Official API did not return a URL, proceed to unblock service if enabled
        if (!unblockEnabled) {
          return isDownloaded ? { error: 'No official URL and unblock disabled', id: numericId } : '';
        }
        // Fall through to unblock service section
      }
    } catch (error: any) {
      console.error('[PlayerStore GetSongUrl] Netease: Official API (getMusicUrl) call failed:', error.message);
      // Official API failed, proceed to unblock service if enabled
      if (!unblockEnabled) {
        return isDownloaded ? { error: 'Official API failed and unblock disabled', id: numericId, details: error.message } : '';
      }
      // Fall through to unblock service section (error implies officialUrl is null)
      officialUrl = null; // Ensure officialUrl is null if API call failed
      officialSongInfo = null;
    }

    // --- Step 2: Try Unblock Service (if official URL was not usable or official API failed, and unblock is enabled) ---
    if (unblockEnabled) {
      console.log('[PlayerStore GetSongUrl] Netease: Step 2 - Attempting Unblock Service (getParsingMusicUrl)');
      try {
        const createTimeoutPromise = (timeoutMs: number, errorMessage: string): { promise: Promise<never>; cancel: () => void } => {
          let timerId: NodeJS.Timeout | undefined;
          const promise = new Promise<never>((_, reject) => {
            timerId = setTimeout(() => {
              console.warn(`[PlayerStore GetSongUrl] Timeout: ${errorMessage}`);
              reject(new Error(errorMessage));
            }, timeoutMs);
          });
          const cancel = () => {
            if (timerId) clearTimeout(timerId);
          };
          return { promise, cancel };
        };

        const unblockServiceTimeoutMs = 7000; // 7 seconds for unblock service
        const unblockServiceTimeout = createTimeoutPromise(unblockServiceTimeoutMs, 'Unblock service request timed out');

        const unblockServiceActualPromise = getParsingMusicUrl(numericId, songData)
          .then((unblockData) => {
            unblockServiceTimeout.cancel();
            if (unblockData && unblockData.url) {
              console.log('[PlayerStore GetSongUrl] Netease: URL from getParsingMusicUrl is usable:', unblockData.url);
              return isDownloaded ? { url: unblockData.url, id: numericId, source: 'unblocked' } : unblockData.url;
            } else {
              console.warn('[PlayerStore GetSongUrl] Netease: getParsingMusicUrl did not return a usable URL.');
              return null;
            }
          })
          .catch((error: any) => {
            unblockServiceTimeout.cancel();
            console.error('[PlayerStore GetSongUrl] Netease: getParsingMusicUrl call failed:', error.message);
            return null;
          });

        const unblockedResult = await Promise.race([unblockServiceActualPromise, unblockServiceTimeout.promise])
          .catch((raceError: any) => {
            console.warn('[PlayerStore GetSongUrl] Netease: Unblock service Promise.race caught error (likely timeout):', raceError.message);
            return null;
          });

        if (unblockedResult && (typeof unblockedResult === 'string' || (typeof unblockedResult === 'object' && unblockedResult.url))) {
          return unblockedResult;
        } else {
          console.warn('[PlayerStore GetSongUrl] Netease: Unblock service also failed or timed out.');
          if (officialUrl) { // Fallback to official URL if unblock failed but official one existed
            console.warn(`[PlayerStore GetSongUrl] Netease: Unblock failed, falling back to (potentially non-playable) official URL: ${officialUrl}`);
            return isDownloaded ? (officialSongInfo || { url: officialUrl, id: numericId, comment: "fallback_official_after_unblock_fail" }) : officialUrl;
          }
          return isDownloaded ? { error: 'All attempts failed (official and unblock)', id: numericId, officialSongInfoIfAny: officialSongInfo } : '';
        }
      } catch (error: any) {
        console.error('[PlayerStore GetSongUrl] Netease: Error during unblock service attempt (outer try-catch):', error.message);
        if (officialUrl) {
          console.warn(`[PlayerStore GetSongUrl] Netease: Unblock attempt threw error, falling back to (potentially non-playable) official URL: ${officialUrl}`);
          return isDownloaded ? (officialSongInfo || { url: officialUrl, id: numericId, comment: "fallback_official_after_unblock_exception" }) : officialUrl;
        }
        return isDownloaded ? { error: 'Unblock service threw an unhandled error', id: numericId, details: error.message } : '';
      }
    } else {
      // Unblock is disabled, and we reached here because official URL was not directly usable OR official API failed.
      console.warn('[PlayerStore GetSongUrl] Netease: Official URL not usable (or API failed) and unblock service is disabled.');
      if (officialUrl) { // If we had an official URL (even if deemed non-playable initially)
        console.warn(`[PlayerStore GetSongUrl] Netease: Unblock disabled, returning the (potentially non-playable) official URL: ${officialUrl}`);
        return isDownloaded ? (officialSongInfo || { url: officialUrl, id: numericId, comment: "direct_official_unblock_disabled_deemed_nonplayable" }) : officialUrl;
      }
      // If officialUrl was null (API failed) and unblock disabled, then it's a definitive failure.
      return isDownloaded ? { error: 'No playable URL found, official API failed or returned unusable, and unblock disabled', id: numericId, officialSongInfoIfAny: officialSongInfo } : '';
    }
  }

  console.error('[PlayerStore GetSongUrl] Unknown song source or logic error. Source:', songData.source);
  return '';
};

const parseTime = (timeString: string): number => {
  const [minutes, seconds] = timeString.split(':');
  return Number(minutes) * 60 + Number(seconds);
};

const parseLyricLine = (lyricLine: string): { time: number; text: string } => {
  const TIME_REGEX = /(\d{2}:\d{2}(\.\d*)?)/g;
  const LRC_REGEX = /(\[(\d{2}):(\d{2})(\.(\d*))?\])/g;
  const timeText = lyricLine.match(TIME_REGEX)?.[0] || '';
  const time = parseTime(timeText);
  const text = lyricLine.replace(LRC_REGEX, '').trim();
  return { time, text };
};

const parseLyrics = (lyricsString: string): { lyrics: ILyricText[]; times: number[] } => {
  const lines = lyricsString.split('\n');
  const lyrics: ILyricText[] = [];
  const times: number[] = [];
  lines.forEach((line) => {
    const { time, text } = parseLyricLine(line);
    times.push(time);
    lyrics.push({ text, trText: '' });
  });
  return { lyrics, times };
};

export const loadLrc = async (id: string | number, source?: SongResult['source']): Promise<ILyric> => {
  // // B站特殊处理 (已注释)
  // if (source === 'bilibili' || (typeof id === 'string' && id.includes('--'))) {
  //   console.log('B站音频，无需加载歌词');
  //   return {
  //     lrcTimeArray: [],
  //     lrcArray: []
  //   };
  // }

  // 酷我音乐处理 (source 为 'other' 时)
  if (source === 'other') {
    console.log('加载 Other (KW) 音乐歌词');
    try {
      const lrcString = await getKwMusicLyric(id as number);
      if (!lrcString) {
        console.warn('酷我歌词为空');
        return { lrcTimeArray: [], lrcArray: [] };
      }
      // 使用已有的 parseLyrics 函数解析LRC字符串
      const { lyrics, times } = parseLyrics(lrcString);
      // kw 歌词没有翻译，所以 trText 为空
      lyrics.forEach(item => item.trText = '');
      return {
        lrcTimeArray: times,
        lrcArray: lyrics
      };
    } catch (err) {
      console.error('Error loading kw lyrics:', err);
      return { lrcTimeArray: [], lrcArray: [] };
    }
  }

  // 默认处理 (网易云或 source 为 undefined 时)
  try {
    const numericId = typeof id === 'string' ? parseInt(id, 10) : id;
    const { data } = await getMusicLrc(numericId);
    const { lyrics, times } = parseLyrics(data.lrc.lyric);
    const tlyric: Record<string, string> = {};

    if (data.tlyric && data.tlyric.lyric) {
      const { lyrics: tLyrics, times: tTimes } = parseLyrics(data.tlyric.lyric);
      tLyrics.forEach((lyric, index) => {
        tlyric[tTimes[index].toString()] = lyric.text;
      });
    }

    lyrics.forEach((item, index) => {
      item.trText = item.text ? tlyric[times[index].toString()] || '' : '';
    });
    return {
      lrcTimeArray: times,
      lrcArray: lyrics
    };
  } catch (err) {
    console.error('Error loading netease lyrics:', err);
    return { lrcTimeArray: [], lrcArray: [] };
  }
};

const loadLrcAsync = async (playMusic: SongResult) => {
  if (playMusic.lyric && playMusic.lyric.lrcTimeArray.length > 0) {
    return;
  }
  // 在调用 loadLrc 时传递 source
  const lyrics = await loadLrc(playMusic.id, playMusic.source);
  playMusic.lyric = lyrics;
};

const getSongDetail = async (playMusic: SongResult) => {
  // playMusic.playLoading 在 handlePlayMusic 中已设置，这里不再设置

  // // Bilibili 逻辑移除 (已注释)
  // if (playMusic.source === 'bilibili') {
  //   console.log('处理B站音频详情');
  //   try {
  //     // 如果需要获取URL
  //     if (!playMusic.playMusicUrl && playMusic.bilibiliData) {
  //       // playMusic.playMusicUrl = await getBilibiliAudioUrl( // 调用 getBilibiliAudioUrl (已注释)
  //       //   playMusic.bilibiliData.bvid,
  //       //   playMusic.bilibiliData.cid
  //       // );
  //     }

  //     playMusic.playLoading = false;
  //     return { ...playMusic } as SongResult;
  //   } catch (error) {
  //     console.error('获取B站音频详情失败:', error);
  //     playMusic.playLoading = false;
  //     throw error;
  //   }
  // }

  if (playMusic.expiredAt && playMusic.expiredAt < Date.now()) {
    console.info(`歌曲已过期，重新获取: ${playMusic.name}`);
    playMusic.playMusicUrl = undefined;
  }

  try {
    const playMusicUrl = playMusic.playMusicUrl || (await getSongUrl(playMusic.id, playMusic));
    playMusic.createdAt = Date.now();
    // 半小时后过期
    playMusic.expiredAt = playMusic.createdAt + 1800000;
    const { backgroundColor, primaryColor } =
      playMusic.backgroundColor && playMusic.primaryColor
        ? playMusic
        : await getImageLinearBackground(getImgUrl(playMusic?.picUrl, '30y30'));

    playMusic.playLoading = false;
    return { ...playMusic, playMusicUrl, backgroundColor, primaryColor } as SongResult;
  } catch (error) {
    console.error('获取音频URL失败:', error);
    playMusic.playLoading = false;
    throw error;
  }
};

const preloadNextSong = (nextSongUrl: string) => {
  try {
    // 清理多余的预加载实例，确保最多只有2个预加载音频
    while (preloadingSounds.value.length >= 2) {
      const oldestSound = preloadingSounds.value.shift();
      if (oldestSound) {
        try {
          oldestSound.stop();
          oldestSound.unload();
        } catch (e) {
          console.error('清理预加载音频实例失败:', e);
        }
      }
    }

    // 检查这个URL是否已经在预加载列表中
    const existingPreload = preloadingSounds.value.find(
      (sound) => (sound as any)._src === nextSongUrl
    );
    if (existingPreload) {
      console.log('该音频已在预加载列表中，跳过:', nextSongUrl);
      return existingPreload;
    }

    const sound = new Howl({
      src: [nextSongUrl],
      html5: true,
      preload: true,
      autoplay: false
    });

    preloadingSounds.value.push(sound);

    sound.on('loaderror', () => {
      console.error('预加载音频失败:', nextSongUrl);
      const index = preloadingSounds.value.indexOf(sound);
      if (index > -1) {
        preloadingSounds.value.splice(index, 1);
      }
      try {
        sound.stop();
        sound.unload();
      } catch (e) {
        console.error('卸载预加载音频失败:', e);
      }
    });

    return sound;
  } catch (error) {
    console.error('预加载音频出错:', error);
    return null;
  }
};

const fetchSongs = async (playList: SongResult[], startIndex: number, endIndex: number) => {
  try {
    const songs = playList.slice(Math.max(0, startIndex), Math.min(endIndex, playList.length));

    const detailedSongs = await Promise.all(
      songs.map(async (song: SongResult) => {
        try {
          if (!song.playMusicUrl || (song.source === 'netease' && !song.backgroundColor)) {
            return await getSongDetail(song);
          }
          return song;
        } catch (error) {
          console.error('获取歌曲详情失败:', error);
          return song;
        }
      })
    );

    const nextSong = detailedSongs[0];
    if (nextSong && !(nextSong.lyric && nextSong.lyric.lrcTimeArray.length > 0)) {
      try {
        nextSong.lyric = await loadLrc(nextSong.id, nextSong.source);
      } catch (error) {
        console.error('加载歌词失败:', error);
      }
    }

    detailedSongs.forEach((song, index) => {
      if (song && startIndex + index < playList.length) {
        playList[startIndex + index] = song;
      }
    });

    if (nextSong && nextSong.playMusicUrl) {
      preloadNextSong(nextSong.playMusicUrl);
    }
  } catch (error) {
    console.error('获取歌曲列表失败:', error);
  }
};

// 定时关闭类型
export enum SleepTimerType {
  NONE = 'none',         // 没有定时
  TIME = 'time',         // 按时间定时
  SONGS = 'songs',       // 按歌曲数定时
  PLAYLIST_END = 'end'   // 播放列表播放完毕定时
}

// 定时关闭信息
export interface SleepTimerInfo {
  type: SleepTimerType;
  value: number;         // 对于TIME类型，值以分钟为单位；对于SONGS类型，值为歌曲数量
  endTime?: number;      // 何时结束（仅TIME类型）
  startSongIndex?: number; // 开始时的歌曲索引（对于SONGS类型）
  remainingSongs?: number; // 剩余歌曲数（对于SONGS类型）
}

export const usePlayerStore = defineStore('player', () => {
  const play = ref(false);
  const isPlay = ref(false);
  const playMusic = ref<SongResult>(getLocalStorageItem('currentPlayMusic', {} as SongResult));
  const playMusicUrl = ref(getLocalStorageItem('currentPlayMusicUrl', ''));
  const playList = ref<SongResult[]>(getLocalStorageItem('playList', []));
  const playListIndex = ref(getLocalStorageItem('playListIndex', 0));
  const playMode = ref(getLocalStorageItem('playMode', 0));
  const musicFull = ref(false);
  const favoriteList = ref<Array<number | string>>(getLocalStorageItem('favoriteList', []));
  const savedPlayProgress = ref<number | undefined>();
  const showSleepTimer = ref(false); // 定时弹窗
  // 添加播放列表抽屉状态
  const playListDrawerVisible = ref(false);

  // 定时关闭相关状态
  const sleepTimer = ref<SleepTimerInfo>(getLocalStorageItem('sleepTimer', {
    type: SleepTimerType.NONE,
    value: 0
  }));

  // 播放速度状态
  const playbackRate = ref(parseFloat(getLocalStorageItem('playbackRate', '1.0')));

  // 清空播放列表
  const clearPlayAll = async () => {
    audioService.pause()
    setTimeout(() => {
      playMusic.value = {} as SongResult;
      playMusicUrl.value = '';
      playList.value = [];
      playListIndex.value = 0;
      localStorage.removeItem('currentPlayMusic');
      localStorage.removeItem('currentPlayMusicUrl');
      localStorage.removeItem('playList');
      localStorage.removeItem('playListIndex');
    }, 500);
  };

  const timerInterval = ref<number | null>(null);

  // 当前定时关闭状态
  const currentSleepTimer = computed(() => sleepTimer.value);

  // 判断是否有活跃的定时关闭
  const hasSleepTimerActive = computed(() => sleepTimer.value.type !== SleepTimerType.NONE);

  // 获取剩余时间（用于UI显示）
  const sleepTimerRemainingTime = computed(() => {
    if (sleepTimer.value.type === SleepTimerType.TIME && sleepTimer.value.endTime) {
      const remaining = Math.max(0, sleepTimer.value.endTime - Date.now());
      return Math.ceil(remaining / 60000); // 转换为分钟并向上取整
    }
    return 0;
  });

  // 获取剩余歌曲数（用于UI显示）
  const sleepTimerRemainingSongs = computed(() => {
    if (sleepTimer.value.type === SleepTimerType.SONGS) {
      return sleepTimer.value.remainingSongs || 0;
    }
    return 0;
  });

  const currentSong = computed(() => playMusic.value);
  const isPlaying = computed(() => isPlay.value);
  const currentPlayList = computed(() => playList.value);
  const currentPlayListIndex = computed(() => playListIndex.value);

  const handlePlayMusic = async (music: SongResult, isPlay: boolean = true) => {
    const currentSound = audioService.getCurrentSound();
    if (currentSound) {
      console.log('主动停止并卸载当前音频实例');
      currentSound.stop();
      currentSound.unload();
    }
    // 先切换歌曲数据，更新播放状态
    // 加载歌词
    await loadLrcAsync(music);
    const originalMusic = { ...music };
    // 获取背景色
    const { backgroundColor, primaryColor } =
      music.backgroundColor && music.primaryColor
        ? music
        : await getImageLinearBackground(getImgUrl(music?.picUrl, '30y30'));
    music.backgroundColor = backgroundColor;
    music.primaryColor = primaryColor;
    music.playLoading = true; // 设置加载状态
    playMusic.value = music;

    // 更新播放相关状态
    play.value = isPlay;

    // 更新标题
    let title = music.name;
    if (music.source === 'netease' && music?.song?.artists) {
      title += ` - ${music.song.artists.reduce(
        (prev: string, curr: any) => `${prev}${curr.name}/`,
        ''
      )}`;
    } else if (music.source === 'other' && music?.ar?.[0]) { // 假设 'other' (酷我) 也有 ar 结构
      title += ` - ${music.ar[0].name}`;
    }
    document.title = 'AlgerMusic - ' + title;

    try {

      // 添加到历史记录
      musicHistory.addMusic(music);

      // 查找歌曲在播放列表中的索引
      const songIndex = playList.value.findIndex(
        (item: SongResult) => item.id === music.id && item.source === music.source
      );

      // 只有在 songIndex 有效，并且与当前 playListIndex 不同时才更新
      if (songIndex !== -1 && songIndex !== playListIndex.value) {
        console.log('歌曲索引不匹配，更新为:', songIndex);
        playListIndex.value = songIndex;
      }

      // 获取歌曲详情，包括URL
      const updatedPlayMusic = await getSongDetail(originalMusic);

      // ---- START: Check for stale update ----
      if (playMusic.value.id !== originalMusic.id) {
        // 这意味着在等待 getSongDetail(originalMusic) 的过程中，
        // 全局的 playMusic.value.id 已经被其他歌曲更新了（通过另一次对 handlePlayMusic 的调用）。
        // 因此，我们为 originalMusic 获取到的 updatedPlayMusic 信息是过时的，不应再用于设置当前播放。
        console.warn(`[PlayerStore handlePlayMusic] Stale update for song ${originalMusic.name} (ID: ${originalMusic.id}). Player has moved to ${playMusic.value.name} (ID: ${playMusic.value.id}). Discarding this stale update for current playback.`);

        // 可选优化：即使不设置为当前播放，也可以尝试更新播放列表中该歌曲的URL，如果获取成功的话
        // updatedPlayMusic 包含了从 getSongDetail 获取到的 playMusicUrl
        if (updatedPlayMusic.playMusicUrl) {
          const songInPlaylistIndex = playList.value.findIndex(item => item.id === updatedPlayMusic.id && item.source === updatedPlayMusic.source);
          if (songInPlaylistIndex !== -1) {
            // 创建一个新的对象来更新，避免直接修改 playList.value[songInPlaylistIndex] 的引用问题
            const newSongDataInPlaylist = { ...playList.value[songInPlaylistIndex], ...updatedPlayMusic };
            playList.value.splice(songInPlaylistIndex, 1, newSongDataInPlaylist);
            console.log(`[PlayerStore handlePlayMusic] Updated song ${updatedPlayMusic.name} (ID: ${updatedPlayMusic.id}) in actual playList with new URL from stale operation.`);
            localStorage.setItem('playList', JSON.stringify(playList.value)); // 确保播放列表的更新被保存
          }
        }
        // playMusic.value.playLoading = false; // 确保原始歌曲的加载状态被清除，因为它不会被播放
        // 对于当前实际播放的歌曲 (playMusic.value)，其 playLoading 状态由其自身的 handlePlayMusic 调用管理
        return false; // 表示本次操作没有成功将歌曲设置为当前播放（因为它过时了）
      }
      // ---- END: Check for stale update ----

      // 如果检查通过，说明当前 playMusic.value.id 仍然是 originalMusic.id，可以安全更新
      playMusic.value = updatedPlayMusic;
      playMusicUrl.value = updatedPlayMusic.playMusicUrl as string;

      // 保存到本地存储
      localStorage.setItem('currentPlayMusic', JSON.stringify(playMusic.value));
      localStorage.setItem('currentPlayMusicUrl', playMusicUrl.value);
      localStorage.setItem('isPlaying', play.value.toString());

      // 无论如何都预加载更多歌曲
      if (songIndex !== -1) {
        setTimeout(() => {
          fetchSongs(playList.value, songIndex + 1, songIndex + 2);
        }, 3000);
      } else {
        console.warn('当前歌曲未在播放列表中找到');
      }

      // 使用标记防止循环调用
      let playInProgress = false;

      // 直接调用 playAudio 方法播放音频
      try {
        if (playInProgress) {
          console.warn('播放操作正在进行中，避免重复调用');
          return true;
        }

        playInProgress = true;
        const result = await playAudio();

        playInProgress = false;
        return !!result;
      } catch (error) {
        console.error('自动播放音频失败:', error);
        playInProgress = false;
        return false;
      }
    } catch (error) {
      console.error('处理播放音乐失败:', error);
      message.error(i18n.global.t('player.playFailed'));
      // 出现错误时，更新加载状态
      if (playMusic.value) {
        playMusic.value.playLoading = false;
      }
      return false;
    }
  };

  const setPlay = async (song: SongResult) => {
    try {
      // 如果是当前正在播放的音乐，则切换播放/暂停状态
      if (playMusic.value.id === song.id && playMusic.value.playMusicUrl === song.playMusicUrl) {
        if (play.value) {
          setPlayMusic(false);
          audioService.getCurrentSound()?.pause();
        } else {
          setPlayMusic(true);
          audioService.getCurrentSound()?.play();
        }
        return;
      }
      // 直接调用 handlePlayMusic，它会处理索引更新和播放逻辑
      const success = await handlePlayMusic(song);

      // 记录到本地存储，保持一致性
      localStorage.setItem('currentPlayMusic', JSON.stringify(playMusic.value));
      localStorage.setItem('currentPlayMusicUrl', playMusicUrl.value);
      if (success) {
        isPlay.value = true;
      }
      return success;
    } catch (error) {
      console.error('设置播放失败:', error);
      return false;
    }
  };

  const setIsPlay = (value: boolean) => {
    isPlay.value = value;
    play.value = value;
    localStorage.setItem('isPlaying', value.toString());
    // 通知主进程播放状态变化
    window.electron?.ipcRenderer.send('update-play-state', value);
  };

  const setPlayMusic = async (value: boolean | SongResult) => {
    if (typeof value === 'boolean') {
      setIsPlay(value);
    } else {
      await handlePlayMusic(value);
      play.value = true;
      isPlay.value = true;
      localStorage.setItem('currentPlayMusic', JSON.stringify(playMusic.value));
      localStorage.setItem('currentPlayMusicUrl', playMusicUrl.value);
    }
  };

  const setMusicFull = (value: boolean) => {
    musicFull.value = value;
  };

  const setPlayList = (list: SongResult[], keepIndex: boolean = false) => {
    // 如果指定保持当前索引，则不重新计算索引
    if (!keepIndex) {
      playListIndex.value = list.findIndex((item) => item.id === playMusic.value.id);
    }
    playList.value = list;
    localStorage.setItem('playList', JSON.stringify(list));
    localStorage.setItem('playListIndex', playListIndex.value.toString());
  };

  const addToNextPlay = (song: SongResult) => {
    const list = [...playList.value];
    const currentIndex = playListIndex.value;

    const existingIndex = list.findIndex((item) => item.id === song.id);
    if (existingIndex !== -1) {
      list.splice(existingIndex, 1);
    }

    list.splice(currentIndex + 1, 0, song);
    setPlayList(list);
  };

  // 睡眠定时器功能
  const setSleepTimerByTime = (minutes: number) => {
    // 清除现有定时器
    clearSleepTimer();

    if (minutes <= 0) {
      return;
    }

    const endTime = Date.now() + minutes * 60 * 1000;

    sleepTimer.value = {
      type: SleepTimerType.TIME,
      value: minutes,
      endTime
    };

    // 保存到本地存储
    localStorage.setItem('sleepTimer', JSON.stringify(sleepTimer.value));

    // 设置定时器检查
    timerInterval.value = window.setInterval(() => {
      checkSleepTimer();
    }, 1000) as unknown as number; // 每秒检查一次

    console.log(`设置定时关闭: ${minutes}分钟后`);
    return true;
  };

  // 睡眠定时器功能
  const setSleepTimerBySongs = (songs: number) => {
    // 清除现有定时器
    clearSleepTimer();

    if (songs <= 0) {
      return;
    }

    sleepTimer.value = {
      type: SleepTimerType.SONGS,
      value: songs,
      startSongIndex: playListIndex.value,
      remainingSongs: songs
    };

    // 保存到本地存储
    localStorage.setItem('sleepTimer', JSON.stringify(sleepTimer.value));

    console.log(`设置定时关闭: 再播放${songs}首歌后`);
    return true;
  };

  // 睡眠定时器功能
  const setSleepTimerAtPlaylistEnd = () => {
    // 清除现有定时器
    clearSleepTimer();

    sleepTimer.value = {
      type: SleepTimerType.PLAYLIST_END,
      value: 0
    };

    // 保存到本地存储
    localStorage.setItem('sleepTimer', JSON.stringify(sleepTimer.value));

    console.log('设置定时关闭: 播放列表结束时');
    return true;
  };

  // 取消定时关闭
  const clearSleepTimer = () => {
    if (timerInterval.value) {
      window.clearInterval(timerInterval.value);
      timerInterval.value = null;
    }

    sleepTimer.value = {
      type: SleepTimerType.NONE,
      value: 0
    };

    // 保存到本地存储
    localStorage.setItem('sleepTimer', JSON.stringify(sleepTimer.value));

    console.log('取消定时关闭');
    return true;
  };

  // 检查定时关闭是否应该触发
  const checkSleepTimer = () => {
    if (sleepTimer.value.type === SleepTimerType.NONE) {
      return;
    }

    if (sleepTimer.value.type === SleepTimerType.TIME && sleepTimer.value.endTime) {
      if (Date.now() >= sleepTimer.value.endTime) {
        // 时间到，停止播放
        stopPlayback();
      }
    } else if (sleepTimer.value.type === SleepTimerType.PLAYLIST_END) {
      // 播放列表结束定时由nextPlay方法处理
    }
  };

  // 停止播放并清除定时器
  const stopPlayback = () => {
    console.log('定时器触发：停止播放');

    if (isPlaying.value) {
      setIsPlay(false);
      audioService.pause();
    }

    // 如果使用Electron，发送通知
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.send('show-notification', {
        title: i18n.global.t('player.sleepTimer.timerEnded'),
        body: i18n.global.t('player.sleepTimer.playbackStopped')
      });
    }

    // 清除定时器
    clearSleepTimer();
  };

  // 监听歌曲变化，处理按歌曲数定时和播放列表结束定时
  const handleSongChange = () => {
    console.log('歌曲已切换，检查定时器状态:', sleepTimer.value);

    // 处理按歌曲数定时
    if (sleepTimer.value.type === SleepTimerType.SONGS && sleepTimer.value.remainingSongs !== undefined) {
      sleepTimer.value.remainingSongs--;
      console.log(`剩余歌曲数: ${sleepTimer.value.remainingSongs}`);

      // 保存到本地存储
      localStorage.setItem('sleepTimer', JSON.stringify(sleepTimer.value));

      if (sleepTimer.value.remainingSongs <= 0) {
        // 歌曲数到达，停止播放
        console.log('已播放完设定的歌曲数，停止播放');
        stopPlayback()
        setTimeout(() => {
          stopPlayback();
        }, 1000);
      }
    }

    // 处理播放列表结束定时
    if (sleepTimer.value.type === SleepTimerType.PLAYLIST_END) {
      // 检查是否到达播放列表末尾
      const isLastSong = (playListIndex.value === playList.value.length - 1);

      // 如果是列表最后一首歌且不是循环模式，则设置为在这首歌结束后停止
      if (isLastSong && playMode.value !== 1) { // 1 是循环模式
        console.log('已到达播放列表末尾，将在当前歌曲结束后停止播放');
        // 转换为按歌曲数定时，剩余1首
        sleepTimer.value = {
          type: SleepTimerType.SONGS,
          value: 1,
          remainingSongs: 1
        };
        // 保存到本地存储
        localStorage.setItem('sleepTimer', JSON.stringify(sleepTimer.value));
      }
    }
  };

  // 修改nextPlay方法，改进播放逻辑
  const nextPlay = async () => {

    try {

      if (playList.value.length === 0) {
        play.value = true;
        return;
      }

      // 检查是否是播放列表的最后一首且设置了播放列表结束定时
      if (playMode.value === 0 && playListIndex.value === playList.value.length - 1 &&
        sleepTimer.value.type === SleepTimerType.PLAYLIST_END) {
        // 已是最后一首且为顺序播放模式，触发停止
        stopPlayback();
        return;
      }

      // 保存当前索引，用于错误恢复
      const currentIndex = playListIndex.value;
      let nowPlayListIndex: number;

      if (playMode.value === 2) {
        // 随机播放模式
        do {
          nowPlayListIndex = Math.floor(Math.random() * playList.value.length);
        } while (nowPlayListIndex === playListIndex.value && playList.value.length > 1);
      } else {
        // 顺序播放或循环播放模式
        nowPlayListIndex = (playListIndex.value + 1) % playList.value.length;
      }

      // 获取下一首歌曲
      let nextSong = { ...playList.value[nowPlayListIndex] };

      // 记录尝试播放过的索引，防止无限循环
      const attemptedIndices = new Set<number>();
      attemptedIndices.add(nowPlayListIndex);

      // 先更新当前播放索引
      playListIndex.value = nowPlayListIndex;

      // 尝试播放
      let success = false;
      let retryCount = 0;
      const maxRetries = Math.min(3, playList.value.length);

      // 尝试播放，最多尝试maxRetries次
      while (!success && retryCount < maxRetries) {
        success = await handlePlayMusic(nextSong, true);

        if (!success) {
          retryCount++;
          console.error(`播放失败，尝试 ${retryCount}/${maxRetries}`);

          if (retryCount >= maxRetries) {
            console.error('多次尝试播放失败，将从播放列表中移除此歌曲');
            // 从播放列表中移除失败的歌曲
            const newPlayList = [...playList.value];
            newPlayList.splice(nowPlayListIndex, 1);

            if (newPlayList.length > 0) {
              // 更新播放列表，但保持当前索引不变
              const keepCurrentIndexPosition = true;
              setPlayList(newPlayList, keepCurrentIndexPosition);

              // 继续尝试下一首
              if (playMode.value === 2) {
                // 随机模式，随机选择一首未尝试过的
                const availableIndices = Array.from(
                  { length: newPlayList.length },
                  (_, i) => i
                ).filter(i => !attemptedIndices.has(i));

                if (availableIndices.length > 0) {
                  // 随机选择一个未尝试过的索引
                  nowPlayListIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
                } else {
                  // 如果所有歌曲都尝试过了，选择下一个索引
                  nowPlayListIndex = (playListIndex.value + 1) % newPlayList.length;
                }
              } else {
                // 顺序播放，选择下一首
                // 如果当前索引已经是最后一首，循环到第一首
                nowPlayListIndex = playListIndex.value >= newPlayList.length
                  ? 0
                  : playListIndex.value;
              }

              playListIndex.value = nowPlayListIndex;
              attemptedIndices.add(nowPlayListIndex);

              if (newPlayList[nowPlayListIndex]) {
                nextSong = { ...newPlayList[nowPlayListIndex] };
                retryCount = 0; // 重置重试计数器，为新歌曲准备
              } else {
                // 处理索引无效的情况
                console.error('无效的播放索引，停止尝试');
                break;
              }
            } else {
              // 播放列表为空，停止尝试
              console.error('播放列表为空，停止尝试');
              break;
            }
          }
        }
      }

      // 歌曲切换成功，触发歌曲变更处理（用于定时关闭功能）
      if (success) {
        handleSongChange();
      } else {
        console.error('所有尝试都失败，无法播放下一首歌曲');
        // 如果尝试了所有可能的歌曲仍然失败，恢复到原始索引
        playListIndex.value = currentIndex;
        setIsPlay(false); // 停止播放
        message.error(i18n.global.t('player.playFailed'));
      }
    } catch (error) {
      console.error('切换下一首出错:', error);
    }
  };

  // 修改 prevPlay 方法，使用与 nextPlay 相似的逻辑改进
  const prevPlay = async () => {


    try {

      if (playList.value.length === 0) {
        play.value = true;
        return;
      }

      // 保存当前索引，用于错误恢复
      const currentIndex = playListIndex.value;
      const nowPlayListIndex =
        (playListIndex.value - 1 + playList.value.length) % playList.value.length;

      // 获取上一首歌曲
      const prevSong = { ...playList.value[nowPlayListIndex] };

      // 重要：首先更新当前播放索引
      playListIndex.value = nowPlayListIndex;

      // 尝试播放
      let success = false;
      let retryCount = 0;
      const maxRetries = 2;

      // 尝试播放，最多尝试maxRetries次
      while (!success && retryCount < maxRetries) {
        success = await handlePlayMusic(prevSong);

        if (!success) {
          retryCount++;
          console.error(`播放上一首失败，尝试 ${retryCount}/${maxRetries}`);

          // 最后一次尝试失败
          if (retryCount >= maxRetries) {
            console.error('多次尝试播放失败，将从播放列表中移除此歌曲');
            // 从播放列表中移除失败的歌曲
            const newPlayList = [...playList.value];
            newPlayList.splice(nowPlayListIndex, 1);

            if (newPlayList.length > 0) {
              // 更新播放列表，但保持当前索引不变
              const keepCurrentIndexPosition = true;
              setPlayList(newPlayList, keepCurrentIndexPosition);

              // 恢复到原始索引或继续尝试上一首
              if (newPlayList.length === 1) {
                // 只剩一首歌，直接播放它
                playListIndex.value = 0;
              } else {
                // 尝试上上一首
                const newPrevIndex = (playListIndex.value - 1 + newPlayList.length) % newPlayList.length;
                playListIndex.value = newPrevIndex;
              }

              // 延迟一点时间再尝试，避免可能的无限循环
              setTimeout(() => {
                prevPlay(); // 递归调用，尝试再上一首
              }, 300);
              return;
            } else {
              // 播放列表为空，停止尝试
              console.error('播放列表为空，停止尝试');
              break;
            }
          }
        }
      }

      if (!success) {
        console.error('所有尝试都失败，无法播放上一首歌曲');
        // 如果尝试了所有可能的歌曲仍然失败，恢复到原始索引
        playListIndex.value = currentIndex;
        setIsPlay(false); // 停止播放
        message.error(i18n.global.t('player.playFailed'));
      }
    } catch (error) {
      console.error('切换上一首出错:', error);
    }
  };

  const togglePlayMode = () => {
    playMode.value = (playMode.value + 1) % 3;
    localStorage.setItem('playMode', JSON.stringify(playMode.value));
  };

  const addToFavorite = async (id: number | string) => {
    const userStore = useUserStore();
    const { message } = createDiscreteApi(['message']);

    if (!userStore.user || !userStore.user.userId) {
      message.error(i18n.global.t('login.loginFirst'));
      return;
    }
    if (!favoriteList.value.includes(id as number)) { // 直接检查数字 ID
      favoriteList.value.push(id as number);
      localStorage.setItem('favoriteList', JSON.stringify(favoriteList.value));
      message.success(i18n.global.t('message.addedToFavorites'));
      if (typeof id === 'number') {
        likeSong(id, true);
      }
    } else {
      message.warning(i18n.global.t('message.alreadyInFavorites'));
    }
  };

  const removeFromFavorite = async (id: number | string) => {
    favoriteList.value = favoriteList.value.filter((favId) => favId !== id);
    localStorage.setItem('favoriteList', JSON.stringify(favoriteList.value));
    message.success(i18n.global.t('message.removedFromFavorites'));
    if (typeof id === 'number') {
      likeSong(id, false);
    }
  };

  const removeFromPlayList = (id: number | string) => {
    const initialLength = playList.value.length;
    playList.value = playList.value.filter(music => music.id !== id);

    if (playList.value.length < initialLength) {
      if (id === playMusic.value.id) {
        nextPlay();
      }
      setPlayList(playList.value);
    }
  };

  // 设置播放速度
  const setPlaybackRate = (rate: number) => {
    playbackRate.value = rate;
    audioService.setPlaybackRate(rate);
    // 保存到本地存储
    localStorage.setItem('playbackRate', rate.toString());
  };

  // 初始化播放状态
  const initializePlayState = async () => {
    const settingStore = useSettingsStore();
    const savedPlayList = getLocalStorageItem('playList', []);
    const savedPlayMusic = getLocalStorageItem<SongResult | null>('currentPlayMusic', null);
    const savedProgress = localStorage.getItem('playProgress');

    if (savedPlayList.length > 0) {
      setPlayList(savedPlayList);
    }

    if (savedPlayMusic && Object.keys(savedPlayMusic).length > 0) {
      try {
        console.log('恢复上次播放的音乐:', savedPlayMusic.name);
        console.log('settingStore.setData', settingStore.setData);
        const isPlaying = settingStore.setData.autoPlay;

        await handlePlayMusic({ ...savedPlayMusic, playMusicUrl: undefined }, isPlaying);

        if (savedProgress) {
          try {
            const progress = JSON.parse(savedProgress);
            if (progress && progress.songId === savedPlayMusic.id) {
              savedPlayProgress.value = progress.progress;
            } else {
              localStorage.removeItem('playProgress');
            }
          } catch (e) {
            console.error('解析保存的播放进度失败', e);
            localStorage.removeItem('playProgress');
          }
        }
      } catch (error) {
        console.error('重新获取音乐链接失败:', error);
        play.value = false;
        isPlay.value = false;
        playMusic.value = {} as SongResult;
        playMusicUrl.value = '';
        localStorage.removeItem('currentPlayMusic');
        localStorage.removeItem('currentPlayMusicUrl');
        localStorage.removeItem('isPlaying');
        localStorage.removeItem('playProgress');
      }
    }

    setTimeout(() => {
      audioService.setPlaybackRate(playbackRate.value);
    }, 2000);

  };

  const initializeFavoriteList = async () => {
    const userStore = useUserStore();
    const localFavoriteList = localStorage.getItem('favoriteList');
    const localList: number[] = localFavoriteList ? JSON.parse(localFavoriteList) : [];

    if (userStore.user && userStore.user.userId) {
      try {
        const res = await getLikedList(userStore.user.userId);
        if (res.data?.ids) {
          const serverList = res.data.ids.reverse();
          const mergedList = Array.from(new Set([...localList, ...serverList]));
          favoriteList.value = mergedList;
        } else {
          favoriteList.value = localList;
        }
      } catch (error) {
        console.error('获取服务器收藏列表失败，使用本地数据:', error);
        favoriteList.value = localList;
      }
    } else {
      favoriteList.value = localList;
    }

    localStorage.setItem('favoriteList', JSON.stringify(favoriteList.value));
  };

  // 修改 playAudio 函数中的错误处理逻辑，避免在操作锁问题时频繁尝试播放
  const playAudio = async () => {
    if (!playMusicUrl.value || !playMusic.value) return null;

    try {
      // 保存当前播放状态
      const shouldPlay = play.value;
      console.log('播放音频，当前播放状态:', shouldPlay ? '播放' : '暂停');

      // 检查是否有保存的进度
      let initialPosition = 0;
      const savedProgress = JSON.parse(localStorage.getItem('playProgress') || '{}');
      if (savedProgress.songId === playMusic.value.id) {
        initialPosition = savedProgress.progress;
      }

      // 播放新音频，传递是否应该播放的状态
      console.log('调用audioService.play，播放状态:', shouldPlay);
      const newSound = await audioService.play(playMusicUrl.value, playMusic.value, shouldPlay);

      // 如果有保存的进度，设置播放位置
      if (initialPosition > 0) {
        newSound.seek(initialPosition);
      }

      // 发布音频就绪事件，让 MusicHook.ts 来处理设置监听器
      window.dispatchEvent(new CustomEvent('audio-ready', { detail: { sound: newSound, shouldPlay } }));

      // 确保状态与 localStorage 同步
      localStorage.setItem('currentPlayMusic', JSON.stringify(playMusic.value));
      localStorage.setItem('currentPlayMusicUrl', playMusicUrl.value);

      return newSound;
    } catch (error) {
      console.error('播放音频失败:', error);
      setPlayMusic(false);

      // 检查错误是否是由于操作锁引起的
      const errorMsg = error instanceof Error ? error.message : String(error);

      // 操作锁错误处理
      if (errorMsg.includes('操作锁激活')) {
        console.log('由于操作锁正在使用，将在1000ms后重试');

        // 强制重置操作锁并延迟再试
        try {
          // 尝试强制重置音频服务的操作锁
          audioService.forceResetOperationLock();
          console.log('已强制重置操作锁');
        } catch (e) {
          console.error('重置操作锁失败:', e);
        }

        // 延迟较长时间，确保锁已完全释放
        setTimeout(() => {
          // 直接重试当前歌曲，而不是切换到下一首
          playAudio().catch(e => {
            console.error('重试播放失败，切换到下一首:', e);

            // 只有再次失败才切换到下一首
            if (playList.value.length > 1) {
              nextPlay();
            }
          });
        }, 1000);
      } else {
        // 其他错误，切换到下一首
        console.log('播放失败，切换到下一首');
        setTimeout(() => {
          nextPlay();
        }, 300);
      }

      message.error(i18n.global.t('player.playFailed'));
      return null;
    }
  };

  // 使用指定的音源重新解析当前播放的歌曲
  const reparseCurrentSong = async (sourcePlatform: Platform | 'netease') => {
    const { message } = createDiscreteApi(['message']);
    if (!playMusic.value || !playMusic.value.id) {
      message.error('没有当前歌曲可供重新解析');
      return false;
    }
    console.log(`[PlayerStore Reparse] Attempting to reparse: ${playMusic.value.name} for platform: ${sourcePlatform}`);
    const currentSong = cloneDeep(playMusic.value);
    let newUrl: string | undefined = undefined;
    let success = false;

    try {
      if (sourcePlatform === 'other') { // 假设 'other' 是酷我
        const kwUrl = await getKwMusicPlayUrl(currentSong.id as number, 'exhigh');
        if (kwUrl && typeof kwUrl === 'string') {
          newUrl = kwUrl;
          success = true;
        } else {
          console.error('从 getKwMusicPlayUrl 获取到的酷我音乐 URL 无效或为 null');
        }
      } else if (sourcePlatform === 'netease') { // 处理 'netease'
        const neteaseUrlData = await getSongUrl(currentSong.id, currentSong);
        if (typeof neteaseUrlData === 'string' && neteaseUrlData.startsWith('http')) {
          newUrl = neteaseUrlData;
          success = true;
        } else if (typeof neteaseUrlData === 'object' && neteaseUrlData !== null && typeof (neteaseUrlData as any).url === 'string' && (neteaseUrlData as any).url.startsWith('http')) {
          newUrl = (neteaseUrlData as any).url;
          success = true;
        } else {
          console.error('从 getSongUrl 获取到的网易云音乐 URL 无效或格式不正确:', neteaseUrlData);
        }
      }
      // 其他平台的解析逻辑可以按需添加, e.g. else if (sourcePlatform === 'qq') { ... }

      if (!success || !newUrl) {
        message.error('无法获取有效的新播放链接');
        return false;
      }

      // 使用新URL更新播放
      const updatedMusic = {
        ...currentSong,
        playMusicUrl: newUrl,
        expiredAt: Date.now() + 1800000  // 半小时后过期
      };

      // 更新播放器状态并开始播放
      await setPlay(updatedMusic);
      setPlayMusic(true);

      return success;
    } catch (error) {
      console.error('重新解析失败:', error);
      return false;
    }
  };

  // 设置播放列表抽屉显示状态
  const setPlayListDrawerVisible = (value: boolean) => {
    playListDrawerVisible.value = value;
  };

  // 播放
  const handlePause = async () => {
    try {
      const currentSound = audioService.getCurrentSound();
      if (currentSound) {
        currentSound.pause();
      }
      setPlayMusic(false);
    } catch (error) {
      console.error('暂停播放失败:', error);
    }
  }

  // 新增：将多首歌曲添加到当前播放列表的末尾
  const addSongsToPlaylist = (songsToAdd: SongResult[]) => {
    if (!Array.isArray(songsToAdd) || songsToAdd.length === 0) {
      return;
    }
    const currentList = playList.value ? [...playList.value] : [];
    // 避免重复添加，基于歌曲ID检查
    const newSongs = songsToAdd.filter(newSong =>
      !currentList.some(existingSong => existingSong.id === newSong.id)
    );
    playList.value = [...currentList, ...newSongs];
    // 如果当前没有播放任何歌曲，并且播放列表之前为空，可以考虑自动播放新添加的第一首歌曲
    if (!playMusic.value && currentList.length === 0 && newSongs.length > 0) {
      setPlay(newSongs[0]);
    }
    message.success(i18n.global.t('player.message.addedToPlaylist', { count: newSongs.length }));
  };

  return {
    play,
    isPlay,
    playMusic,
    playMusicUrl,
    playList,
    playListIndex,
    playMode,
    musicFull,
    savedPlayProgress,
    favoriteList,
    playListDrawerVisible,

    // 定时关闭相关
    sleepTimer,
    showSleepTimer,
    currentSleepTimer,
    hasSleepTimerActive,
    sleepTimerRemainingTime,
    sleepTimerRemainingSongs,
    setSleepTimerByTime,
    setSleepTimerBySongs,
    setSleepTimerAtPlaylistEnd,
    clearSleepTimer,

    currentSong,
    isPlaying,
    currentPlayList,
    currentPlayListIndex,

    clearPlayAll,
    setPlay,
    setIsPlay,
    nextPlay,
    prevPlay,
    setPlayMusic,
    setMusicFull,
    setPlayList,
    addToNextPlay,
    togglePlayMode,
    initializePlayState,
    initializeFavoriteList,
    addToFavorite,
    removeFromFavorite,
    removeFromPlayList,
    playAudio,
    reparseCurrentSong,
    setPlayListDrawerVisible,
    handlePause,
    playbackRate,
    setPlaybackRate,
    addSongsToPlaylist
  };
});

