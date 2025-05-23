<template>
  <n-drawer :show="show" height="100%" placement="bottom" :z-index="999999999" :to="`#layout-main`">
    <div class="mv-detail">
      
      <div
        ref="videoContainerRef"
        class="video-container"
        :class="{ 'cursor-hidden': !showCursor && !isMobile }"
        @mousemove="handleVideoAreaMouseMove"
        @mouseleave="handleVideoAreaMouseLeave"
        @click="handleVideoAreaClick"
      >
        <video
          ref="videoRef"
          :src="mvUrl"
          class="video-player"
          preload="metadata"
          @ended="handleEnded"
          @timeupdate="handleTimeUpdate"
          @loadedmetadata="handleLoadedMetadata"
          @play="isPlaying = true"
          @pause="isPlaying = false"
        ></video>

        <div class="custom-controls" :class="{ 'controls-hidden': !showControls }" @click.stop>
          <div class="progress-bar custom-slider">
            <n-slider
              v-model:value="progress"
              :min="0"
              :max="100"
              :tooltip="false"
              :step="0.1"
              @update:value="handleProgressChange"
            />
          </div>

          <div class="controls-main">
            <div class="left-controls">
              <n-tooltip v-if="!props.noList" placement="top" :disabled="isMobile">
                <template #trigger>
                  <n-button quaternary circle @click.stop="handlePrev">
                    <template #icon>
                      <n-icon size="24">
                        <n-spin v-if="prevLoading" size="small" />
                        <i v-else class="ri-skip-back-line"></i>
                      </n-icon>
                    </template>
                  </n-button>
                </template>
                {{ t('player.previous') }}
              </n-tooltip>

              <n-tooltip placement="top" :disabled="isMobile">
                <template #trigger>
                  <n-button quaternary circle @click.stop="handlePlayPauseButtonClick">
                    <template #icon>
                      <n-icon size="24">
                        <n-spin v-if="playLoading" size="small" />
                        <i v-else :class="isPlaying ? 'ri-pause-line' : 'ri-play-line'"></i>
                      </n-icon>
                    </template>
                  </n-button>
                </template>
                {{ isPlaying ? t('player.pause') : t('player.play') }}
              </n-tooltip>

              <n-tooltip v-if="!props.noList" placement="top" :disabled="isMobile">
                <template #trigger>
                  <n-button quaternary circle @click.stop="handleNext">
                    <template #icon>
                      <n-icon size="24">
                        <n-spin v-if="nextLoading" size="small" />
                        <i v-else class="ri-skip-forward-line"></i>
                      </n-icon>
                    </template>
                  </n-button>
                </template>
                {{ t('player.next') }}
              </n-tooltip>

              <div class="time-display">
                {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
              </div>
            </div>

            <div class="right-controls">
              <div v-if="!isMobile" class="volume-control custom-slider">
                <n-tooltip placement="top">
                  <template #trigger>
                    <n-button quaternary circle @click.stop="toggleMute">
                      <template #icon>
                        <n-icon size="24">
                          <i :class="volume === 0 ? 'ri-volume-mute-line' : 'ri-volume-up-line'"></i>
                        </n-icon>
                      </template>
                    </n-button>
                  </template>
                  {{ volume === 0 ? t('player.unmute') : t('player.mute') }}
                </n-tooltip>
                <n-slider
                  v-model:value="volume"
                  :min="0"
                  :max="100"
                  :tooltip="false"
                  class="volume-slider"
                />
              </div>

              <n-tooltip placement="top" :disabled="isMobile">
                <template #trigger>
                  <n-button quaternary circle class="play-mode-btn" @click.stop="togglePlayMode">
                    <template #icon>
                      <n-icon size="24">
                        <i :class="playMode === 'single' ? 'ri-repeat-one-line' : 'ri-play-list-line'"></i>
                      </n-icon>
                    </template>
                  </n-button>
                </template>
                {{ playMode === 'single' ? t('player.modeHint.single') : t('player.modeHint.list') }}
              </n-tooltip>

              <n-tooltip placement="top" :disabled="isMobile">
                <template #trigger>
                  <n-button quaternary circle @click.stop="toggleFullscreen">
                    <template #icon>
                      <n-icon size="24">
                        <i :class="isFullscreen ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line'"></i>
                      </n-icon>
                    </template>
                  </n-button>
                </template>
                {{ isFullscreen ? t('player.fullscreen.exit') : t('player.fullscreen.enter') }}
              </n-tooltip>

              <n-tooltip placement="top" :disabled="isMobile">
                <template #trigger>
                  <n-button quaternary circle @click.stop="handleClose">
                    <template #icon>
                      <n-icon size="24">
                        <i class="ri-close-line"></i>
                      </n-icon>
                    </template>
                  </n-button>
                </template>
                {{ t('player.close') }}
              </n-tooltip>
            </div>
          </div>
        </div>

        <transition name="fade">
          <div v-if="showModeHint" class="mode-hint">
            <n-icon size="48" class="mode-icon">
              <i :class="playMode === 'single' ? 'ri-repeat-one-line' : 'ri-play-list-line'"></i>
            </n-icon>
            <div class="mode-text">
              {{ playMode === 'single' ? t('player.modeHint.single') : t('player.modeHint.list') }}
            </div>
          </div>
        </transition>
        
        <div v-if="autoPlayBlocked && !isPlaying" class="play-blocked-hint" @click.stop="handleVideoAreaClick">
            <n-icon size="64" color="rgba(255,255,255,0.8)">
                 <i class="ri-play-circle-line"></i>
            </n-icon>
            <p style="color: rgba(255,255,255,0.8); margin-top: 8px;">{{ t('player.tapToPlay') }}</p>
        </div>

      </div>

      <div class="mv-detail-title" :class="{ 'title-hidden': !showControls && isPlaying }">
        <div class="title">
          <n-ellipsis>{{ currentMv?.name }}</n-ellipsis>
        </div>
        <n-button v-if="isMobile" quaternary circle @click.stop="handleClose" class="mobile-close-btn-top">
            <template #icon>
              <n-icon size="24"><i class="ri-arrow-down-s-line"></i></n-icon>
            </template>
          </n-button>
      </div>
    </div>
  </n-drawer>
</template>

<script setup lang="ts">
import { NButton, NIcon, NSlider, NTooltip, useMessage, type MessageReactive } from 'naive-ui';
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { getMvUrl } from '@/api/mv';
import { IMvItem } from '@/type/mv';
import { isMobile } from '@/utils';

const { t } = useI18n();
const message = useMessage();

type PlayMode = 'single' | 'auto';
const PLAY_MODE = {
  Single: 'single' as PlayMode,
  Auto: 'auto' as PlayMode
} as const;

const props = withDefaults(
  defineProps<{
    show: boolean;
    currentMv?: IMvItem;
    noList?: boolean;
  }>(),
  {
    show: false,
    currentMv: undefined,
    noList: false
  }
);

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void;
  (e: 'next', loading: (value: boolean) => void): void;
  (e: 'prev', loading: (value: boolean) => void): void;
}>();

const mvUrl = ref<string>();
const playMode = ref<PlayMode>(PLAY_MODE.Auto);

let recentlyStartedPlaying = false;
let recentlyStartedTimer: NodeJS.Timeout | null = null;

const videoRef = ref<HTMLVideoElement>();
const videoContainerRef = ref<HTMLDivElement>();
const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const progress = ref(0);
const volume = ref(100);
const lastVolume = ref(100);
const showControls = ref(true);
const showCursor = ref(true);
const autoPlayBlocked = ref(false);
const playLoading = ref(false);
const nextLoading = ref(false);
const prevLoading = ref(false);
const isFullscreen = ref(false);
const showModeHint = ref(false);

let activeLoadingMessage: MessageReactive | null = null;

let controlsTimer: NodeJS.Timeout | null = null;
let cursorTimer: NodeJS.Timeout | null = null;
let modeHintTimer: NodeJS.Timeout | null = null;

const formatTime = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const resetControlsTimer = () => {
  if (controlsTimer) clearTimeout(controlsTimer);
  if (isPlaying.value && !isMobile.value) {
    controlsTimer = setTimeout(() => {
      showControls.value = false;
    }, 3000);
  }
};

const resetCursorTimer = () => {
  if (isMobile.value) return;
  if (cursorTimer) clearTimeout(cursorTimer);
  cursorTimer = setTimeout(() => {
    showCursor.value = false;
  }, 3000);
};

const handleVideoAreaMouseMove = () => {
  if (isMobile.value) return;
  showControls.value = true;
  showCursor.value = true;
  resetControlsTimer();
  resetCursorTimer();
};

const handleVideoAreaMouseLeave = () => {
  if (isMobile.value) return;
  if (isPlaying.value) {
    showControls.value = false;
  }
  showCursor.value = false;
};

const handleVideoAreaClick = () => {
  console.log('[MVPlayer_Debug] handleVideoAreaClick triggered');
  console.log('[MVPlayer_Debug] isMobile:', isMobile.value, 'recentlyStartedPlaying:', recentlyStartedPlaying, 'showControls before:', showControls.value);

  if (autoPlayBlocked.value) {
    console.log('[MVPlayer_Debug] autoPlayBlocked is true, attempting to play...');
    videoRef.value?.play()
      .then(() => {
        console.log('[MVPlayer_Debug] Play successful after autoPlayBlocked');
        isPlaying.value = true;
        autoPlayBlocked.value = false; 
        showControls.value = true;      
      })
      .catch((err) => {
        console.error('[MVPlayer] Play failed after autoPlayBlocked:', err);
        autoPlayBlocked.value = true;
        isPlaying.value = false;
        showControls.value = true; 
      });
  } else { 
    if (isMobile.value) {
      if (recentlyStartedPlaying && showControls.value) {
        console.log('[MVPlayer_Debug] Mobile, video just started (recentlyStartedPlaying=true) and controls are shown, click ignored for toggling.');
      } else {
        console.log('[MVPlayer_Debug] Mobile, normal toggle for showControls.');
        showControls.value = !showControls.value;
      }
    } else { 
      console.log('[MVPlayer_Debug] PC device: toggling play or showing controls.');
      if (showControls.value) {
        togglePlay();
      } else {
        showControls.value = true;
      }
    }
  }

  if (!isMobile.value) {
    showCursor.value = true;
    resetCursorTimer();
  }
  
  console.log('[MVPlayer_Debug] final showControls after logic:', showControls.value);
};

const handlePlayPauseButtonClick = () => {
  togglePlay();
};

const togglePlay = async () => {
  if (!videoRef.value) return;
  playLoading.value = true;
  if (isPlaying.value) {
    videoRef.value.pause();
  } else {
    try {
      await videoRef.value.play();
      autoPlayBlocked.value = false;
    } catch (error: any) {
      console.error('Error attempting to play MV:', error);
      if (error.name === 'NotAllowedError') {
        autoPlayBlocked.value = true;
        isPlaying.value = false;
        showControls.value = true;
      }
    }
  }
  playLoading.value = false;
};

const handleTimeUpdate = () => {
  if (!videoRef.value) return;
  currentTime.value = videoRef.value.currentTime;
  progress.value = duration.value ? (currentTime.value / duration.value) * 100 : 0;
};

const handleLoadedMetadata = async () => {
  if (!videoRef.value) return;
  duration.value = videoRef.value.duration;
  volume.value = videoRef.value.volume * 100;
  
  if (props.show) {
    console.log('[MVPlayer_Debug] handleLoadedMetadata: Before play, props.show is true. Setting showControls = true.');
    showControls.value = true;
    console.log('[MVPlayer_Debug] handleLoadedMetadata: showControls is now', showControls.value);
    try {
      await videoRef.value.play();
      console.log('[MVPlayer_Debug] handleLoadedMetadata: Play successful.');
      autoPlayBlocked.value = false;
    } catch (error: any) {
      console.error('[MVPlayer] Error auto-playing MV on loadedmetadata:', error);
      if (error.name === 'NotAllowedError') {
        autoPlayBlocked.value = true;
        isPlaying.value = false; 
      }
    }
    console.log('[MVPlayer_Debug] handleLoadedMetadata: After play attempt, showControls is', showControls.value);
  }
};

const handleProgressChange = (value: number) => {
  if (!videoRef.value || !duration.value) return;
  videoRef.value.currentTime = (value / 100) * duration.value;
  resetControlsTimer();
  if (!isMobile.value) resetCursorTimer();
};

const handleClose = () => {
  if (videoRef.value) {
    videoRef.value.pause();
  }
  isPlaying.value = false;
  showControls.value = true;
  emit('update:show', false);
  currentTime.value = 0;
  progress.value = 0;
  duration.value = 0;
  mvUrl.value = '';
  autoPlayBlocked.value = false;
};

const handleEnded = () => {
  if (playMode.value === PLAY_MODE.Single) {
    if (videoRef.value) {
      videoRef.value.currentTime = 0;
      videoRef.value.play();
    }
  } else if (!props.noList) {
    handleNext();
  } else {
    isPlaying.value = false;
    showControls.value = true;
  }
};

const togglePlayMode = () => {
  if (playMode.value === PLAY_MODE.Auto) {
    playMode.value = PLAY_MODE.Single;
  } else {
    playMode.value = PLAY_MODE.Auto;
  }
  showModeHint.value = true;
  if (modeHintTimer) clearTimeout(modeHintTimer);
  modeHintTimer = setTimeout(() => {
    showModeHint.value = false;
  }, 1500);
  resetControlsTimer();
  if (!isMobile.value) resetCursorTimer();
};

const toggleMute = () => {
  if (!videoRef.value) return;
  if (videoRef.value.volume > 0) {
    lastVolume.value = volume.value;
    videoRef.value.volume = 0;
    volume.value = 0;
  } else {
    videoRef.value.volume = lastVolume.value / 100;
    volume.value = lastVolume.value;
  }
  resetControlsTimer();
  if (!isMobile.value) resetCursorTimer();
};

watch(volume, (newVolume) => {
  if (videoRef.value) {
    videoRef.value.volume = newVolume / 100;
    if (newVolume > 0) {
        lastVolume.value = newVolume;
    }
  }
});

const toggleFullscreen = () => {
  if (!videoContainerRef.value) return;
  if (!document.fullscreenElement) {
    videoContainerRef.value.requestFullscreen?.();
    isFullscreen.value = true;
  } else {
    document.exitFullscreen?.();
    isFullscreen.value = false;
  }
  resetControlsTimer();
  if (!isMobile.value) resetCursorTimer();
};

const handleNext = () => {
  if (props.noList) return;
  nextLoading.value = true;
  emit('next', (loading: boolean) => {
    nextLoading.value = loading;
  });
  resetControlsTimer();
  if (!isMobile.value) resetCursorTimer();
};

const handlePrev = () => {
  if (props.noList) return;
  prevLoading.value = true;
  emit('prev', (loading: boolean) => {
    prevLoading.value = loading;
  });
  resetControlsTimer();
  if (!isMobile.value) resetCursorTimer();
};

const handleFullscreenChange = () => {
  isFullscreen.value = !!document.fullscreenElement;
};

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isFullscreen.value) {
    toggleFullscreen();
  }
  if (event.key === ' ' && props.show) {
    event.preventDefault();
    togglePlay();
  }
};

const initVideo = async () => {
  if (props.currentMv && props.currentMv.id) {
    if (playLoading.value) return;

    if (activeLoadingMessage) {
      activeLoadingMessage.destroy();
      activeLoadingMessage = null;
    }
    activeLoadingMessage = message.loading(t('mv.loading'), { duration: 0 });
    playLoading.value = true;

    try {
      const mvId = typeof props.currentMv.id === 'string' ? parseInt(props.currentMv.id) : props.currentMv.id;
      if (typeof mvId !== 'number' || isNaN(mvId)) {
        console.error('[MVPlayer] Invalid MV ID in initVideo:', props.currentMv.id);
        message.error(t('mv.loadFailedInvalidId'));
        throw new Error('Invalid MV ID');
      }
      console.log('[MVPlayer] initVideo: Fetching MV URL for ID:', mvId);
      const res = await getMvUrl(mvId as number);
      console.log('[MVPlayer] initVideo: API Response for ID', mvId, ':', JSON.stringify(res.data));

      if (res.data.code === 200 && res.data.data && res.data.data.url) {
        mvUrl.value = res.data.data.url.replace(/^http:/, 'https:');
        console.log('[MVPlayer] initVideo: Set mvUrl to:', mvUrl.value);
        autoPlayBlocked.value = false;
        isPlaying.value = false;
        currentTime.value = 0;
        progress.value = 0;
        await nextTick();
        if (videoRef.value) {
          videoRef.value.load();
        }
      } else {
        console.error('[MVPlayer] initVideo: Failed to get MV URL from API for ID', mvId, '. Response:', JSON.stringify(res.data));
        mvUrl.value = '';
        if (res.data.data && res.data.data.msg) {
          message.error(res.data.data.msg);
        } else if (res.data.msg && typeof res.data.msg === 'string' && res.data.msg.trim() !== '') {
          message.error(res.data.msg);
        }
        else {
          message.error(t('mv.loadFailed'));
        }
      }
    } catch (error) {
      console.error('[MVPlayer] Error fetching MV URL in initVideo for ID', props.currentMv?.id, ':', error);
      mvUrl.value = '';
      message.error(t('mv.initFailed'));
    } finally {
      playLoading.value = false;
      if (activeLoadingMessage) {
        activeLoadingMessage.destroy();
        activeLoadingMessage = null;
      }
    }
  }
};

watch(
  () => props.currentMv,
  (newMv) => {
    if (newMv && props.show) {
      initVideo();
    } else if (!props.show && videoRef.value) {
        videoRef.value.pause();
        mvUrl.value = '';
    }
  },
  { immediate: true, deep: true }
);

watch(
  () => props.show,
  (newShow) => {
    if (newShow) {
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('keydown', handleKeyDown);
      if (props.currentMv?.id && !mvUrl.value) {
        initVideo();
      } else if (mvUrl.value && videoRef.value) {
        // Potentially resume or re-check state if URL already exists
      }
      showControls.value = true;
      if (!isMobile.value) {
        showCursor.value = true;
        resetCursorTimer();
      }
      if (props.currentMv?.id) {
        loadMvDetail(props.currentMv.id);
      }
    } else {
      if (videoRef.value) {
        videoRef.value.pause();
        videoRef.value.src = '';
      }
      if (activeLoadingMessage) {
        activeLoadingMessage.destroy();
        activeLoadingMessage = null;
      }
      isPlaying.value = false;
      currentTime.value = 0;
      progress.value = 0;
      duration.value = 0;
      playLoading.value = false;
      autoPlayBlocked.value = false;

      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyDown);
      if (controlsTimer) clearTimeout(controlsTimer);
      if (cursorTimer) clearTimeout(cursorTimer);
      if (modeHintTimer) clearTimeout(modeHintTimer);
    }
  }
);

watch(isPlaying, (playing) => {
    console.log('[MVPlayer_Debug] watch(isPlaying): isPlaying changed to:', playing);
    if (playing) { 
        if (!isMobile.value) { 
            resetControlsTimer();
            resetCursorTimer();
        } else { 
            console.log('[MVPlayer_Debug] watch(isPlaying): Mobile playing. Preparing to set showControls = true via nextTick.');
            nextTick(() => {
              showControls.value = true; 
              console.log('[MVPlayer_Debug] watch(isPlaying): Mobile, in nextTick, after setting, showControls is', showControls.value);
              
              recentlyStartedPlaying = true;
              if (recentlyStartedTimer) clearTimeout(recentlyStartedTimer);
              recentlyStartedTimer = setTimeout(() => {
                  recentlyStartedPlaying = false;
              }, 1500);
            });

            if (controlsTimer) clearTimeout(controlsTimer);
            if (cursorTimer) clearTimeout(cursorTimer); 
            showCursor.value = true; 
        }
    } else { 
        // Video stopped/paused
        if ((window as any).mvControlsInterval) {
            clearInterval((window as any).mvControlsInterval);
            (window as any).mvControlsInterval = null; 
            console.log('[MVPlayer_Debug] Interval: Clearing interval because video stopped/paused (safety check).');
        }
        if (controlsTimer) clearTimeout(controlsTimer);
        if (cursorTimer) clearTimeout(cursorTimer);
        console.log('[MVPlayer_Debug] watch(isPlaying): Video stopped/paused. Setting showControls = true.');
        showControls.value = true; 
        console.log('[MVPlayer_Debug] watch(isPlaying): Stopped/paused, after setting, showControls is', showControls.value);
        if(!isMobile.value) showCursor.value = true;
        
        if (recentlyStartedTimer) clearTimeout(recentlyStartedTimer);
        recentlyStartedPlaying = false;
    }
});

const loadMvDetail = async (id: number) => {
  if (playLoading.value) return;

  if (activeLoadingMessage) {
    activeLoadingMessage.destroy();
    activeLoadingMessage = null;
  }
  activeLoadingMessage = message.loading(t('mv.loading'), { duration: 0 });
  playLoading.value = true;
  try {
    console.log('[MVPlayer] loadMvDetail: Fetching MV URL for ID:', id);
    const res = await getMvUrl(id);
    console.log('[MVPlayer] loadMvDetail: API Response for ID', id, ':', JSON.stringify(res.data));

    if (res.data.code === 200 && res.data.data && res.data.data.url) {
      mvUrl.value = res.data.data.url.replace(/^http:/, 'https:');
      console.log('[MVPlayer] loadMvDetail: Set mvUrl to:', mvUrl.value);
      autoPlayBlocked.value = false;
      isPlaying.value = false;
      currentTime.value = 0;
      progress.value = 0;
      await nextTick();
      if (videoRef.value) {
        videoRef.value.volume = volume.value / 100;
        try {
          await videoRef.value.play();
          isPlaying.value = true;
          autoPlayBlocked.value = false;
        } catch (error: any) {
          console.warn('MV自动播放失败:', error);
          if (error.name === 'NotAllowedError') {
            autoPlayBlocked.value = true;
            message.warning(t('player.autoplayBlocked'), { duration: 3000 });
          }
        }
      }
    } else {
      console.error('[MVPlayer] loadMvDetail: Failed to get MV URL from API for ID', id, '. Response:', JSON.stringify(res.data));
      if (res.data.data && res.data.data.msg) {
        message.error(res.data.data.msg);
      } else if (res.data.msg && typeof res.data.msg === 'string' && res.data.msg.trim() !== '') {
        message.error(res.data.msg);
      }
      else {
        message.error(t('mv.loadFailed'));
      }
      emit('update:show', false);
    }
  } catch (error) {
    console.error('[MVPlayer] Error in loadMvDetail for ID', id, ':', error);
    message.error(t('mv.loadFailed'));
    emit('update:show', false);
  } finally {
    playLoading.value = false;
    if (activeLoadingMessage) {
      activeLoadingMessage.destroy();
      activeLoadingMessage = null;
    }
  }
};

onMounted(() => {
  if (videoRef.value) {
    volume.value = videoRef.value.volume * 100;
    lastVolume.value = volume.value;
  }
});

onUnmounted(() => {
  if (controlsTimer) clearTimeout(controlsTimer);
  if (cursorTimer) clearTimeout(cursorTimer);
  if (modeHintTimer) clearTimeout(modeHintTimer);
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
  document.removeEventListener('keydown', handleKeyDown);

  if (activeLoadingMessage) {
    activeLoadingMessage.destroy();
    activeLoadingMessage = null;
  }
});
</script>

<style scoped lang="scss">
.mv-detail {
  @apply h-full bg-light dark:bg-black;

  &-title {
    @apply fixed top-0 left-0 right-0 p-4 z-10 transition-opacity duration-300;
    background: linear-gradient(to bottom, rgba(0, 0, 0, 0.7), transparent);

    .title {
      @apply text-white text-lg font-bold;
    }
  }
}

.video-container {
  @apply h-full w-full relative;
  position: relative;
  background-color: #000;

  .video-player {
    @apply h-full w-full object-contain bg-black;
  }

  .custom-controls {
    @apply absolute bottom-0 left-0 right-0 p-4;
    padding-bottom: 96px !important;
    display: flex !important;
    flex-direction: column !important;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent);
    transition: opacity 0.3s ease-in-out;
    color: rgba(255, 255, 255, 0.9) !important;
    min-height: auto !important;
    width: 100% !important;
    z-index: 999 !important;

    .progress-bar {
        @apply mb-4;
        width: 100% !important;
        height: 20px !important;
    }

    .controls-main {
      @apply flex justify-between items-center;
      width: 100% !important;
      min-height: 40px !important;

      .left-controls,
      .right-controls {
        @apply flex items-center gap-2;
        .n-button { 
          color: rgba(255, 255, 255, 0.85) !important;
          transition: color 0.3s;
          &:hover {
            color: #34d399 !important;
          }
          min-width: 30px !important;
          min-height: 30px !important;
        }
        .time-display {
          color: rgba(255, 255, 255, 0.85) !important;
          @apply text-sm ml-4;
        }
      }
    }
  }
}

.controls-hidden {
   opacity: 0 !important; 
   pointer-events: none !important; 
}

.mode-hint {
  @apply absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center;

  .mode-icon {
    @apply text-white mb-2;
  }

  .mode-text {
    @apply text-white text-sm;
  }
}

.custom-slider {
  :deep(.n-slider) {
    --n-rail-height: 4px;
    --n-rail-color: theme('colors.gray.200');
    --n-rail-color-dark: theme('colors.gray.700');
    --n-fill-color: theme('colors.green.500');
    --n-handle-size: 12px;
    --n-handle-color: theme('colors.green.500');

    &.n-slider--vertical {
      height: 100%;

      .n-slider-rail {
        width: 4px;
      }

      &:hover {
        .n-slider-rail {
          width: 6px;
        }

        .n-slider-handle {
          width: 14px;
          height: 14px;
        }
      }
    }

    .n-slider-rail {
      @apply overflow-hidden transition-all duration-200;
      @apply bg-gray-500 dark:bg-dark-300 bg-opacity-10 !important;
    }

    .n-slider-handle {
      @apply transition-all duration-200;
      opacity: 0;
    }

    &:hover .n-slider-handle {
      opacity: 1;
    }
  }
}

.progress-bar {
  @apply mb-4;

  .progress-rail {
    @apply relative w-full h-1 bg-gray-600;

    .progress-buffer {
      @apply absolute top-0 left-0 h-full bg-gray-400;
    }
  }
}

.volume-control {
  @apply flex items-center gap-2;

  .volume-slider {
    width: 100px;
  }
}

.cursor-hidden {
  cursor: none;
}

.title-hidden {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease-in-out;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.play-blocked-hint {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 5;
}

.mobile-close-btn-top {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 20;
    color: white;
}

.mobile {
  .custom-controls {
    .n-button {
      .n-icon {
      }
    }
  }
  .mv-detail-title {
      padding-left: 40px; 
  }
}
</style>
