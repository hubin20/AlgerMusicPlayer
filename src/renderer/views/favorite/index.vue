  <template>
    <div v-if="isComponent ? favoriteSongs.length : true" class="favorite-page">
      <div class="favorite-header" :class="setAnimationClass('animate__fadeInLeft')">
        <div class="favorite-header-left">
          <h2>{{ t('favorite.title') }}</h2>
          <div class="favorite-count">{{ t('favorite.count', { count: favoriteList.length }) }}</div>
        </div>
        <div v-if="!isComponent && isElectron" class="favorite-header-right">
          <!-- <div class="sort-controls" v-if="!isSelecting">
            <div class="sort-buttons">
              <div 
                class="sort-button" 
                :class="{ active: isDescending }"
                @click="toggleSort(true)"
              >
                <i class="iconfont ri-sort-desc"></i>
                {{ t('favorite.descending') }}
              </div>
              <div 
                class="sort-button" 
                :class="{ active: !isDescending }"
                @click="toggleSort(false)"
              >
                <i class="iconfont ri-sort-asc"></i>
                {{ t('favorite.ascending') }}
              </div>
            </div>
          </div> -->
          <n-button
            v-if="!isSelecting"
            secondary
            type="primary"
            size="small"
            class="select-btn"
            @click="startSelect"
          >
            <template #icon>
              <i class="iconfont ri-checkbox-multiple-line"></i>
            </template>
            {{ t('favorite.batchDownload') }}
          </n-button>
          <div v-else class="select-controls">
            <n-checkbox
              class="select-all-checkbox"
              :checked="isAllSelected"
              :indeterminate="isIndeterminate"
              @update:checked="handleSelectAll"
            >
              {{ t('common.selectAll') }}
            </n-checkbox>
            <n-button-group class="operation-btns">
              <n-button
                type="primary"
                size="small"
                :loading="isDownloading"
                :disabled="selectedSongs.length === 0"
                class="download-btn"
                @click="handleBatchDownload"
              >
                <template #icon>
                  <i class="iconfont ri-download-line"></i>
                </template>
                {{ t('favorite.download', { count: selectedSongs.length }) }}
              </n-button>
              <n-button size="small" class="cancel-btn" @click="cancelSelect">
                {{ t('common.cancel') }}
              </n-button>
            </n-button-group>
          </div>
        </div>
      </div>
      <div class="favorite-main" :class="setAnimationClass('animate__bounceInRight')">
        <n-scrollbar ref="scrollbarRef" class="favorite-content" @scroll="handleScroll">
          <div v-if="favoriteList.length === 0" class="empty-tip">
            <n-empty :description="t('favorite.emptyTip')" />
          </div>
          <div v-else class="favorite-list" :class="{ 'max-w-[400px]': isComponent }">
            <song-item
              v-for="(song, index) in favoriteSongs"
              :key="song.id"
              :item="song"
              :favorite="false"
              :class="setAnimationClass('animate__bounceInLeft')"
              :style="getItemAnimationDelay(index)"
              :selectable="isSelecting"
              :selected="selectedSongs.includes(song.id as number)"
              @play="handlePlay"
              @select="handleSelect"
            />
            <div v-if="isComponent" class="favorite-list-more text-center">
              <n-button text type="primary" @click="handleMore">{{ t('common.viewMore') }}</n-button>
            </div>

            <div v-if="loading" class="loading-wrapper">
              <n-spin size="large" />
            </div>

            <div v-if="noMore" class="no-more-tip">{{ t('common.noMore') }}</div>
          </div>
        </n-scrollbar>
      </div>
    </div>
  </template>

  <script setup lang="ts">
  import { cloneDeep } from 'lodash';
  import { useMessage } from 'naive-ui';
  import { computed, onMounted, ref, watch } from 'vue';
  import { useI18n } from 'vue-i18n';
  import { useRouter } from 'vue-router';

  import { getMusicDetail } from '@/api/music';
  import SongItem from '@/components/common/SongItem.vue';
  import { getSongUrl } from '@/store/modules/player';
  import { usePlayerStore } from '@/store';
  import type { SongResult } from '@/type/music';
  import { isElectron, setAnimationClass, setAnimationDelay } from '@/utils';

  const playerStore = usePlayerStore();
  const { t } = useI18n();
  const message = useMessage();
  const router = useRouter();

  const favoriteList = computed(() => playerStore.favoriteList);
  const favoriteSongs = ref<SongResult[]>([]);
  const loading = ref(false);
  const noMore = ref(false);
  const scrollbarRef = ref();

  // 多选相关
  const isSelecting = ref(false);
  const selectedSongs = ref<number[]>([]);
  const isDownloading = ref(false);

  // 开始多选
  const startSelect = () => {
    isSelecting.value = true;
    selectedSongs.value = [];
  };

  // 取消多选
  const cancelSelect = () => {
    isSelecting.value = false;
    selectedSongs.value = [];
  };

  // 处理选择
  const handleSelect = (songId: number, selected: boolean) => {
    if (selected) {
      selectedSongs.value.push(songId);
    } else {
      selectedSongs.value = selectedSongs.value.filter((id) => id !== songId);
    }
  };

  // 批量下载
  const handleBatchDownload = async () => {
    if (isDownloading.value) {
      message.warning(t('favorite.downloading'));
      return;
    }

    if (selectedSongs.value.length === 0) {
      message.warning(t('favorite.selectSongsFirst'));
      return;
    }

    try {
      isDownloading.value = true;
      message.success(t('favorite.downloading'));

      // 移除旧的监听器
      window.electron.ipcRenderer.removeAllListeners('music-download-complete');

      let successCount = 0;
      let failCount = 0;

      // 添加新的监听器
      window.electron.ipcRenderer.on('music-download-complete', (_, result) => {
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }

        // 当所有下载完成时
        if (successCount + failCount === selectedSongs.value.length) {
          isDownloading.value = false;
          message.success(t('favorite.downloadSuccess'));
          cancelSelect();
        }
      });

      // 获取选中歌曲的信息
      const selectedSongsList = selectedSongs.value
        .map((songId) => favoriteSongs.value.find((s) => s.id === songId))
        .filter((song) => song) as SongResult[];

      // 并行获取所有歌曲的下载链接
      const downloadUrls = await Promise.all(
        selectedSongsList.map(async (song) => {
          try {
            const data = (await getSongUrl(song.id, song, true)) as any;
            return { song, ...data };
          } catch (error) {
            console.error(`获取歌曲 ${song.name} 下载链接失败:`, error);
            return { song, url: null };
          }
        })
      );

      // 开始下载有效的链接
      downloadUrls.forEach(({ song, url, type }) => {
        if (!url) {
          failCount++;
          return;
        }
        const songData = cloneDeep(song);
        const songInfo = {
          ...songData,
          ar: songData.ar || songData.song?.artists,
          downloadTime: Date.now()
        };
        console.log('songInfo', songInfo);
        console.log('song', song);
        window.electron.ipcRenderer.send('download-music', {
          url,
          filename: `${song.name} - ${(song.ar || song.song?.artists)?.map((a) => a.name).join(',')}`,
          songInfo,
          type
        });
      });
    } catch (error) {
      console.error('下载失败:', error);
      isDownloading.value = false;
      message.destroyAll();
      message.error(t('favorite.downloadFailed'));
    }
  };

  // 排序相关
  const isDescending = ref(true); // 默认倒序显示
  const currentPage = ref(1);
  const pageSize = 20;

  // defineProps 声明 props，props 变量本身在 <script setup> 中可以不使用
  defineProps({
    isComponent: {
      type: Boolean,
      default: false
    }
  });

  const getFavoriteSongs = async () => {
    if (loading.value || noMore.value) return;

    loading.value = true;
    try {
      const listToProcess = isDescending.value ? [...favoriteList.value].reverse() : [...favoriteList.value];
      const startIndex = (currentPage.value - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const currentPageIds = listToProcess.slice(startIndex, endIndex);

      const neteaseIds = currentPageIds.filter((id): id is number => typeof id === 'number'); // 只处理数字ID（网易云）

      let newSongs: SongResult[] = [];

      // 处理网易云音乐
      if (neteaseIds.length > 0) {
        const res = await getMusicDetail(neteaseIds);
        if (res.data.songs) {
          const songsWithDetails = res.data.songs.map((song: SongResult) => ({
            ...song,
            picUrl: song.al?.picUrl || '',
            source: 'netease'
          }));
          newSongs = newSongs.concat(songsWithDetails);
        }
      }

      // 根据原始 favoriteList 的顺序（或反序）来重新排序 newSongs
      const orderedNewSongs = currentPageIds.map(id => newSongs.find(song => song.id === id)).filter(song => song) as SongResult[];

      if (currentPage.value === 1) {
        favoriteSongs.value = orderedNewSongs;
      } else {
        favoriteSongs.value = [...favoriteSongs.value, ...orderedNewSongs];
      }

      noMore.value = favoriteSongs.value.length >= favoriteList.value.filter(id => typeof id === 'number').length; // 只与网易云收藏比较
    } catch (error) {
      console.error(t('favorite.getFailed'), error);
    } finally {
      loading.value = false;
    }
  };

  // 处理滚动事件
  const handleScroll = (e: any) => {
    const { scrollTop, scrollHeight, offsetHeight } = e.target;
    const threshold = 100; // 距离底部多少像素时加载更多

    if (!loading.value && !noMore.value && scrollHeight - (scrollTop + offsetHeight) < threshold) {
      currentPage.value++;
      getFavoriteSongs();
    }
  };

  onMounted(async () => {
    await playerStore.initializeFavoriteList();
    await getFavoriteSongs();
  });

  // 监听收藏列表变化
  watch(
    favoriteList,
    () => {
      currentPage.value = 1;
      noMore.value = false;
      getFavoriteSongs();
    },
    { deep: true, immediate: true }
  );

  const handlePlay = () => {
    playerStore.setPlayList(favoriteSongs.value);
  };

  const getItemAnimationDelay = (index: number) => {
    return setAnimationDelay(index, 30);
  };

  const handleMore = () => {
    router.push('/history');
  };

  // 全选相关
  const isAllSelected = computed(() => {
    return (
      favoriteSongs.value.length > 0 && selectedSongs.value.length === favoriteSongs.value.length
    );
  });

  const isIndeterminate = computed(() => {
    return selectedSongs.value.length > 0 && selectedSongs.value.length < favoriteSongs.value.length;
  });

  // 处理全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      selectedSongs.value = favoriteSongs.value.map((song) => song.id as number);
    } else {
      selectedSongs.value = [];
    }
  };
  </script>

  <style lang="scss" scoped>
  .favorite-page {
    @apply h-full flex flex-col pt-2;
    @apply bg-light dark:bg-black;

    .favorite-header {
      @apply flex items-center justify-between flex-shrink-0 px-4 pb-2;

      &-left {
        @apply flex items-center gap-4;

        h2 {
          @apply text-xl font-bold;
          @apply text-gray-900 dark:text-white;
        }

        .favorite-count {
          @apply text-gray-500 dark:text-gray-400 text-sm;
        }
      }

      &-right {
        @apply flex items-center gap-3;

        .sort-controls {
          @apply flex items-center;
          
          .sort-buttons {
            @apply flex items-center bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden;
            @apply border border-gray-200 dark:border-gray-700;
            
            .sort-button {
              @apply flex items-center py-1 px-3 text-sm cursor-pointer;
              @apply text-gray-600 dark:text-gray-400;
              @apply transition-all duration-300;
              
              &:first-child {
                @apply border-r border-gray-200 dark:border-gray-700;
              }
              
              .iconfont {
                @apply mr-1 text-base;
              }
              
              &.active {
                @apply bg-green-500 text-white dark:text-gray-100;
                @apply font-medium;
              }
              
              &:hover:not(.active) {
                @apply bg-gray-200 dark:bg-gray-700;
              }
            }
          }
        }

        .select-btn {
          @apply rounded-full px-4 h-8;
          @apply transition-all duration-300 ease-in-out;
          @apply hover:bg-primary hover:text-white;
          @apply dark:border-gray-600;

          .iconfont {
            @apply mr-1 text-lg;
          }
        }

        .select-controls {
          @apply flex items-center gap-3;
          @apply bg-gray-50 dark:bg-gray-800;
          @apply rounded-full px-3 py-1;
          @apply border border-gray-200 dark:border-gray-700;
          @apply transition-all duration-300;

          .select-all-checkbox {
            @apply text-sm text-gray-900 dark:text-gray-200;
          }

          .operation-btns {
            @apply flex items-center gap-2 ml-2;

            .download-btn {
              @apply rounded-full px-4 h-7;
              @apply bg-primary text-white;
              @apply hover:bg-primary-dark;
              @apply disabled:opacity-50 disabled:cursor-not-allowed;

              .iconfont {
                @apply mr-1 text-lg;
              }
            }

            .cancel-btn {
              @apply rounded-full px-4 h-7;
              @apply text-gray-600 dark:text-gray-300;
              @apply hover:bg-gray-100 dark:hover:bg-gray-700;
              @apply border-gray-300 dark:border-gray-600;
            }
          }
        }
      }
    }

    .favorite-main {
      @apply flex flex-col flex-grow min-h-0;

      .favorite-content {
        @apply flex-grow min-h-0;

        .empty-tip {
          @apply h-full flex items-center justify-center;
          @apply text-gray-500 dark:text-gray-400;
        }

        .favorite-list {
          @apply space-y-2 pb-4 px-4;

          &-more {
            @apply mt-4;

            .n-button {
              @apply text-green-500 hover:text-green-600;
            }
          }
        }
      }
    }
  }

  .loading-wrapper {
    @apply flex justify-center items-center py-20;
  }

  .no-more-tip {
    @apply text-center py-4 text-sm;
    @apply text-gray-500 dark:text-gray-400;
  }

  .mobile {
    .favorite-page {
      @apply p-4;

      .favorite-header {
        @apply mb-4;

        h2 {
          @apply text-xl;
        }
      }
    }
  }
  </style>
