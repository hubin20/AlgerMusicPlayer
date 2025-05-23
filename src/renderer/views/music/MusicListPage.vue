<template>
  <div class="music-page">
    <div class="music-header h-12 flex items-center justify-between">
      <n-ellipsis :line-clamp="1" class="flex-shrink-0 mr-3">
        <div class="music-title">
          {{ name }}
        </div>
      </n-ellipsis>

      <!-- 搜索框和布局切换 -->
      <div class="flex-grow flex-1 flex items-center justify-end gap-2">
        <!-- 操作按钮组 -->
        <n-tooltip placement="bottom" trigger="hover">
          <template #trigger>
            <div class="action-button hover-green" @click="handlePlayAll">
              <i class="icon iconfont ri-play-fill"></i>
            </div>
          </template>
          {{ t('comp.musicList.playAll') }}
        </n-tooltip>

        <n-tooltip v-if="canCollect" placement="bottom" trigger="hover">
          <template #trigger>
            <div class="action-button" :class="isCollected ? 'collected' : 'hover-green'" @click="toggleCollect">
              <i class="icon iconfont" :class="isCollected ? 'ri-heart-fill' : 'ri-heart-line'"></i>
            </div>
          </template>
          {{ isCollected ? t('comp.musicList.cancelCollect') : t('comp.musicList.collect') }}
        </n-tooltip>

        <n-tooltip placement="bottom" trigger="hover">
          <template #trigger>
            <div class="action-button hover-green" @click="addToPlaylist">
              <i class="icon iconfont ri-add-line"></i>
            </div>
          </template>
          {{ t('comp.musicList.addToPlaylist') }}
        </n-tooltip>
        <!-- 布局切换按钮 -->
        <div class="layout-toggle" v-if="!isMobile">
          <n-tooltip placement="bottom" trigger="hover">
            <template #trigger>
              <div class="toggle-button hover-green" @click="toggleLayout">
                <i class="icon iconfont" :class="isCompactLayout ? 'ri-list-check-2' : 'ri-grid-line'"></i>
              </div>
            </template>
            {{ isCompactLayout ? t('comp.musicList.switchToNormal') : t('comp.musicList.switchToCompact') }}
          </n-tooltip>
        </div>

        <div class="search-container" :class="{ 'search-expanded': isSearchVisible }">
          <template v-if="isSearchVisible">
            <n-input
              v-model:value="searchKeyword"
              :placeholder="t('comp.musicList.searchSongs')"
              clearable
              round
              size="small"
              @blur="handleSearchBlur"
            >
              <template #prefix>
                <i class="icon iconfont ri-search-line text-sm"></i>
              </template>
              <template #suffix>
                <i class="icon iconfont ri-close-line text-sm cursor-pointer" @click="closeSearch"></i>
              </template>
            </n-input>
          </template>
          <template v-else>
            <n-tooltip placement="bottom" trigger="hover">
              <template #trigger>
                <div class="search-button" @click="showSearch">
                  <i class="icon iconfont ri-search-line"></i>
                </div>
              </template>
              {{ t('comp.musicList.searchSongs') }}
            </n-tooltip>
          </template>
        </div>
      </div>
    </div>

    <div class="music-content">
      <!-- 左侧歌单信息 -->
      <div class="music-info">
        <div class="music-cover">
          <n-image
            :src="getImgUrl(getCoverImgUrl, '500y500')"
            class="cover-img"
            preview-disabled
            :class="setAnimationClass('animate__fadeIn')"
            object-fit="cover"
          />
        </div>
        <div v-if="listInfo?.creator" class="creator-info">
          <n-avatar round :size="24" :src="getImgUrl(listInfo.creator.avatarUrl, '50y50')" />
          <span class="creator-name">{{ listInfo.creator.nickname }}</span>
        </div>
        <div v-if="total" class="music-total">{{ t('player.songNum', { num: total }) }}</div>

        <n-scrollbar style="max-height: 200px">
          <div v-if="listInfo?.description" class="music-desc">
            {{ listInfo.description }}
          </div>
        </n-scrollbar>
      </div>

      <!-- 右侧歌曲列表 -->
      <div class="music-list-container">
        <div class="music-list">
          <n-spin :show="loadingList || loading">
            <div class="music-list-content">
              <div v-if="filteredSongs.length === 0 && searchKeyword" class="no-result">
                {{ t('comp.musicList.noSearchResults') }}
              </div>

              <!-- 虚拟列表，设置正确的固定高度 -->
              <n-virtual-list
                ref="songListRef"
                class="song-virtual-list"
                style="height: calc(80vh - 60px)"
                :items="filteredSongs"
                :item-size="isCompactLayout ? 50 : 70"
                item-resizable
                key-field="id"
                @scroll="handleVirtualScroll"
              >
                <template #default="{ item, index }">
                  <div class="double-item">
                    <song-item  
                      :index="index"
                      :compact="isCompactLayout"
                      :item="formatSong(item)"
                      :can-remove="canRemove"
                      @play="handlePlay"
                      @remove-song="handleRemoveSong"
                    />
                  </div>
                </template>
              </n-virtual-list>
            </div>
          </n-spin>
        </div>
      </div>
    </div>
    <play-bottom />
  </div>
</template>

<script setup lang="ts">
// 添加组件名称定义
defineOptions({
  name: 'MusicList'
});

import PinyinMatch from 'pinyin-match';
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import { updatePlaylistTracks, subscribePlaylist } from '@/api/music';
import { useMessage } from 'naive-ui';

import { getMusicDetail, getMusicListByType } from '@/api/music';
import SongItem from '@/components/common/SongItem.vue';
import PlayBottom from '@/components/common/PlayBottom.vue';
import { useMusicStore, usePlayerStore } from '@/store';
import { SongResult } from '@/type/music';
import { getImgUrl, isMobile, setAnimationClass } from '@/utils';

const { t } = useI18n();
const route = useRoute();
const playerStore = usePlayerStore();
const musicStore = useMusicStore();
const message = useMessage();

// 从路由参数或状态管理获取数据
const name = ref('');
const loading = ref(false);
const songList = ref<any[]>([]);
const listInfo = ref<any>(null);
const canRemove = ref(false);
const canCollect = ref(false);
const isCollected = ref(false);

const page = ref(0);
const pageSize = 40;
const isLoadingMore = ref(false);
const displayedSongs = ref<SongResult[]>([]);
const loadingList = ref(false);
const loadedIds = ref(new Set<number>()); // 用于追踪已加载的歌曲ID
const isPlaylistLoading = ref(false); // 标记是否正在加载播放列表
const completePlaylist = ref<SongResult[]>([]); // 存储完整的播放列表
const hasMore = ref(true); // 标记是否还有更多数据可加载
const searchKeyword = ref(''); // 搜索关键词
const isFullPlaylistLoaded = ref(false); // 标记完整播放列表是否已加载完成

// 添加搜索相关的状态和方法
const isSearchVisible = ref(false);
const isCompactLayout = ref(isMobile.value ? false : localStorage.getItem('musicListLayout') === 'compact'); // 默认使用紧凑布局

const showSearch = () => {
  isSearchVisible.value = true;
  // 添加一个小延迟后聚焦搜索框
  nextTick(() => {
    const inputEl = document.querySelector('.search-container input');
    if (inputEl) {
      (inputEl as HTMLInputElement).focus();
    }
  });
};

const closeSearch = () => {
  isSearchVisible.value = false;
  searchKeyword.value = '';
};

const handleSearchBlur = () => {
  // 如果搜索框为空，则在失焦时关闭搜索框
  if (!searchKeyword.value) {
    setTimeout(() => {
      isSearchVisible.value = false;
    }, 200);
  }
};

// 计算总数
const total = computed(() => {
  if (listInfo.value?.trackIds) {
    return listInfo.value.trackIds.length;
  }
  return songList.value.length;
});

// 初始化数据
onMounted(() => {
  initData();
  checkCollectionStatus();
});

// 从 pinia 或路由参数获取数据
const initData = () => {
  // 优先从 pinia 获取数据
  if (musicStore.currentMusicList && musicStore.currentMusicListName && musicStore.currentListInfo) {
    name.value = musicStore.currentMusicListName;
    songList.value = musicStore.currentMusicList;
    listInfo.value = musicStore.currentListInfo;
    canRemove.value = musicStore.canRemoveSong || false;

    // 根据类型调整数据结构
    if (listInfo.value && route.query.type === 'album') {
      // 如果是专辑，创建者信息在 artist 或 artists 字段
      if (!listInfo.value.creator && listInfo.value.artist) {
        listInfo.value.creator = {
          avatarUrl: listInfo.value.artist.img1v1Url || listInfo.value.artist.picUrl,
          nickname: listInfo.value.artist.name
        };
      } else if (!listInfo.value.creator && listInfo.value.artists && listInfo.value.artists.length > 0) {
        listInfo.value.creator = {
          avatarUrl: listInfo.value.artists[0].img1v1Url || listInfo.value.artists[0].picUrl,
          nickname: listInfo.value.artists[0].name
        };
      }
       // 专辑描述通常在 album.description
       // listInfo.description 已在 SearchItem 中被赋值为 album.description
    }

    initSongList(songList.value);
    // 如果是从路由直接进入，需要检查收藏状态
    if (route.params.id) {
      checkCollectionStatus();
    }
    return; // 从 Pinia 获取数据成功，则返回
  }

  // 如果 Pinia 中没有，则尝试从路由参数加载
  const id = route.params.id as string;
  const type = route.query.type as string;
  const listNameFromQuery = route.query.name as string;

  if (id && type) {
    loading.value = true;
    canRemove.value = type === 'playlist' && musicStore.isUserPlaylist(Number(id)); // 只有用户的歌单可编辑
    getMusicListByType(id, type)
      .then((result: any) => {
        if (type === 'album') {
          const { album, songs } = result.data;
          name.value = album.name;
          // 专辑的歌曲列表在 songs 中，封面在 album.picUrl
          // 专辑的艺术家信息在 album.artist 或 album.artists
          // 专辑的描述在 album.description
          songList.value = songs.map((song: any) => {
            song.al = song.al || {}; // 确保 al 对象存在
            song.al.picUrl = song.al.picUrl || album.picUrl; // 使用专辑封面作为歌曲的专辑封面
            song.picUrl = song.al.picUrl || album.picUrl || song.picUrl;
            return song;
          });
          listInfo.value = {
            ...album,
            coverImgUrl: album.picUrl, // 统一封面字段
            creator: album.artist ? { // 统一创建者/艺术家信息
              avatarUrl: album.artist.img1v1Url || album.artist.picUrl,
              nickname: album.artist.name
            } : (album.artists && album.artists.length > 0 ? {
              avatarUrl: album.artists[0].img1v1Url || album.artists[0].picUrl,
              nickname: album.artists[0].name
            } : { nickname: '未知艺术家', avatarUrl: '' }),
            description: album.description || ''
          };
        } else if (type === 'playlist') {
          const { playlist } = result.data;
          name.value = playlist.name;
          songList.value = playlist.tracks || [];
          listInfo.value = playlist; // playlist 对象结构已包含 creator, coverImgUrl, description
        }
        initSongList(songList.value);
        checkCollectionStatus(); // 加载完数据后检查收藏状态
      })
      .catch((error) => {
        console.error('加载数据失败:', error);
        message.error(t('user.message.getDataFail'));
      })
      .finally(() => {
        loading.value = false;
      });
  } else if (listNameFromQuery) {
    name.value = listNameFromQuery;
  }
};

const getCoverImgUrl = computed(() => {
  if (listInfo.value?.coverImgUrl) {
    return listInfo.value.coverImgUrl;
  }
  // 兼容旧的专辑数据可能没有 coverImgUrl 但有 picUrl
  if (listInfo.value?.picUrl && route.query.type === 'album') {
    return listInfo.value.picUrl;
  }

  const song = songList.value[0];
  if (song?.picUrl) {
    return song.picUrl;
  }
  if (song?.al?.picUrl) {
    return song.al.picUrl;
  }
  if (song?.album?.picUrl) {
    return song.album.picUrl;
  }
  return '';
});

// 过滤歌曲列表
const filteredSongs = computed(() => {
  if (!searchKeyword.value) {
    return displayedSongs.value;
  }

  const keyword = searchKeyword.value.toLowerCase().trim();
  return displayedSongs.value.filter((song) => {
    const songName = song.name?.toLowerCase() || '';
    const albumName = song.al?.name?.toLowerCase() || '';
    const artists = song.ar || song.artists || [];

    // 原始文本匹配
    const nameMatch = songName.includes(keyword);
    const albumMatch = albumName.includes(keyword);
    const artistsMatch = artists.some((artist: any) => {
      return artist.name?.toLowerCase().includes(keyword);
    });

    // 拼音匹配
    const namePinyinMatch = song.name && PinyinMatch.match(song.name, keyword);
    const albumPinyinMatch = song.al?.name && PinyinMatch.match(song.al.name, keyword);
    const artistsPinyinMatch = artists.some((artist: any) => {
      return artist.name && PinyinMatch.match(artist.name, keyword);
    });

    return (
      nameMatch ||
      albumMatch ||
      artistsMatch ||
      namePinyinMatch ||
      albumPinyinMatch ||
      artistsPinyinMatch
    );
  });
});

// 格式化歌曲数据
const formatSong = (item: any) => {
  if (!item) {
    return null;
  }
  return {
    ...item,
    picUrl: item.al?.picUrl || item.picUrl,
    song: {
      artists: item.ar || item.artists,
      name: item.al?.name || item.name,
      id: item.al?.id || item.id
    }
  };
};

/**
 * 加载歌曲数据的核心函数
 * @param ids 要加载的歌曲ID数组
 * @param appendToList 是否将加载的歌曲追加到现有列表
 * @param updateComplete 是否更新完整播放列表
 */
const loadSongs = async (ids: number[], appendToList = true, updateComplete = false) => {
  if (ids.length === 0) return [];

  try {
    console.log(`请求歌曲详情，ID数量: ${ids.length}`);
    const { data } = await getMusicDetail(ids);

    if (data?.songs) {
      console.log(`API返回歌曲数量: ${data.songs.length}`);

      // 直接使用API返回的所有歌曲，不再过滤已加载的歌曲
      // 因为当需要完整加载列表时，我们希望获取所有歌曲，即使ID可能重复
      const { songs } = data;

      // 只在非更新完整列表时执行过滤
      let newSongs = songs;
      if (!updateComplete) {
        // 在普通加载模式下继续过滤已加载的歌曲，避免重复
        newSongs = songs.filter((song: any) => !loadedIds.value.has(song.id));
        console.log(`过滤已加载ID后剩余歌曲数量: ${newSongs.length}`);
      }

      // 更新已加载ID集合
      songs.forEach((song: any) => {
        loadedIds.value.add(song.id);
      });

      // 追加到显示列表 - 仅当appendToList=true时添加到displayedSongs
      if (appendToList) {
        displayedSongs.value.push(...newSongs);
      }

      // 更新完整播放列表 - 仅当updateComplete=true时添加到completePlaylist
      if (updateComplete) {
        completePlaylist.value.push(...songs);
        console.log(`已添加到完整播放列表，当前完整列表长度: ${completePlaylist.value.length}`);
      }

      return updateComplete ? songs : newSongs;
    }
    console.log('API返回无歌曲数据');
    return [];
  } catch (error) {
    console.error('加载歌曲失败:', error);
  }

  return [];
};

// 加载完整播放列表
const loadFullPlaylist = async () => {
  if (isPlaylistLoading.value || isFullPlaylistLoaded.value) return;

  isPlaylistLoading.value = true;
  // 记录开始时间
  const startTime = Date.now();
  console.log(`开始加载完整播放列表，当前显示列表长度: ${displayedSongs.value.length}`);

  try {
    // 如果没有trackIds，直接使用当前歌曲列表并标记为已完成
    if (!listInfo.value?.trackIds) {
      isFullPlaylistLoaded.value = true;
      console.log('无trackIds信息，使用当前列表作为完整列表');
      return;
    }

    // 获取所有trackIds
    const allIds = listInfo.value.trackIds.map((item) => item.id);
    console.log(`歌单共有歌曲ID: ${allIds.length}首`);

    // 重置completePlaylist和当前显示歌曲ID集合，保证不会重复添加歌曲
    completePlaylist.value = [];

    // 使用Set记录所有已加载的歌曲ID
    const loadedSongIds = new Set<number>();

    // 将当前显示列表中的歌曲和ID添加到集合中
    displayedSongs.value.forEach((song) => {
      loadedSongIds.add(song.id as number);
      // 将已有歌曲添加到completePlaylist
      completePlaylist.value.push(song);
    });

    console.log(
      `已有显示歌曲: ${displayedSongs.value.length}首，已有ID数量: ${loadedSongIds.size}`
    );

    // 过滤出尚未加载的歌曲ID
    const unloadedIds = allIds.filter((id) => !loadedSongIds.has(id));
    console.log(`还需要加载的歌曲ID数量: ${unloadedIds.length}`);

    if (unloadedIds.length === 0) {
      console.log('所有歌曲已加载，无需再次加载');
      isFullPlaylistLoaded.value = true;
      hasMore.value = false;
      return;
    }

    // 分批加载所有未加载的歌曲
    const batchSize = 500; // 每批加载的歌曲数量

    for (let i = 0; i < unloadedIds.length; i += batchSize) {
      const batchIds = unloadedIds.slice(i, i + batchSize);
      if (batchIds.length === 0) continue;

      console.log(`请求第${Math.floor(i / batchSize) + 1}批歌曲，数量: ${batchIds.length}`);
      // 关键修改: 设置appendToList为false，避免loadSongs直接添加到displayedSongs
      const loadedBatch = await loadSongs(batchIds, false, false);

      // 添加新加载的歌曲到displayedSongs
      if (loadedBatch.length > 0) {
        // 过滤掉已有的歌曲，确保不会重复添加
        const newSongs = loadedBatch.filter((song) => !loadedSongIds.has(song.id as number));

        // 更新已加载ID集合
        newSongs.forEach((song) => {
          loadedSongIds.add(song.id as number);
        });

        console.log(`新增${newSongs.length}首歌曲到显示列表`);

        // 更新显示列表和完整播放列表
        if (newSongs.length > 0) {
          // 添加到显示列表
          displayedSongs.value = [...displayedSongs.value, ...newSongs];

          // 添加到完整播放列表
          completePlaylist.value.push(...newSongs);

          // 如果当前正在播放的列表与这个列表匹配，实时更新播放列表
          const currentPlaylist = playerStore.playList;
          if (currentPlaylist.length > 0 && currentPlaylist[0].id === displayedSongs.value[0]?.id) {
            console.log('实时更新当前播放列表');
            playerStore.setPlayList(displayedSongs.value.map(formatSong));
          }
        }
      }

      // 添加小延迟避免请求过于密集
      if (i + batchSize < unloadedIds.length) {
        await new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 100);
        });
      }
    }

    // 加载完成，更新状态
    isFullPlaylistLoaded.value = true;
    hasMore.value = false;

    // 计算加载耗时
    const endTime = Date.now();
    const timeUsed = Math.round(((endTime - startTime) / 1000) * 100) / 100;

    console.log(
      `完整播放列表加载完成，共加载${displayedSongs.value.length}首歌曲，耗时${timeUsed}秒`
    );
    console.log(`歌单应有${allIds.length}首歌，实际加载${displayedSongs.value.length}首`);

    // 检查加载的歌曲数量是否与预期相符
    if (displayedSongs.value.length !== allIds.length) {
      console.warn(
        `警告: 加载的歌曲数量(${displayedSongs.value.length})与歌单应有数量(${allIds.length})不符`
      );

      // 如果数量不符，可能是API未返回所有歌曲，打印缺失的歌曲ID
      if (displayedSongs.value.length < allIds.length) {
        const loadedIds = new Set(displayedSongs.value.map((song) => song.id));
        const missingIds = allIds.filter((id) => !loadedIds.has(id));
        console.warn(`缺失的歌曲ID: ${missingIds.join(', ')}`);
      }
    }
  } catch (error) {
    console.error('加载完整播放列表失败:', error);
  } finally {
    isPlaylistLoading.value = false;
  }
};

// 处理播放
const handlePlay = async () => {
  // 当搜索状态下播放时，只播放过滤后的歌曲
  if (searchKeyword.value) {
    playerStore.setPlayList(filteredSongs.value.map(formatSong));
    return;
  }

  // 如果完整播放列表已加载完成
  if (isFullPlaylistLoaded.value && completePlaylist.value.length > 0) {
    playerStore.setPlayList(completePlaylist.value.map(formatSong));
    return;
  }

  // 如果完整播放列表未加载完成，先使用当前已加载的歌曲开始播放
  playerStore.setPlayList(displayedSongs.value.map(formatSong));

  // 如果完整播放列表正在加载中，不需要重新触发加载
  if (isPlaylistLoading.value) {
    return;
  }

  // 在后台继续加载完整播放列表（如果未加载完成）
  if (!isFullPlaylistLoaded.value) {
    console.log('播放时继续在后台加载完整列表');
    loadFullPlaylist();
  }
};

// 添加从歌单移除歌曲的方法
const handleRemoveSong = async (songId: number) => {
  if (!listInfo.value?.id || !canRemove.value) return;

  try {
    const res = await updatePlaylistTracks({
      op: 'del',
      pid: listInfo.value.id,
      tracks: songId.toString()
    });

    if (res.status === 200) {
      message.success(t('user.message.deleteSuccess'));
      
      // 从显示列表和完整播放列表中移除歌曲
      displayedSongs.value = displayedSongs.value.filter(song => song.id !== songId);
      completePlaylist.value = completePlaylist.value.filter(song => song.id !== songId);
      
      // 如果正在播放该列表，也需要更新播放列表
      const currentPlaylist = playerStore.playList;
      if (currentPlaylist.length > 0 && currentPlaylist[0].id === displayedSongs.value[0]?.id) {
        playerStore.setPlayList(displayedSongs.value.map(formatSong));
      }
      
      // 从Pinia状态中也移除
      if (musicStore.currentMusicList) {
        musicStore.removeSongFromList(songId);
      }
    } else {
      throw new Error(res.data?.msg || t('user.message.deleteFailed'));
    }
  } catch (error: any) {
    console.error('删除歌曲失败:', error);
    message.error(error.message || t('user.message.deleteFailed'));
  }
};

// 加载更多歌曲
const loadMoreSongs = async () => {
  if (isFullPlaylistLoaded.value) {
    hasMore.value = false;
    return;
  }

  if (searchKeyword.value) {
    return;
  }

  if (isLoadingMore.value || displayedSongs.value.length >= total.value) {
    hasMore.value = false;
    return;
  }

  isLoadingMore.value = true;

  try {
    const start = displayedSongs.value.length;
    const end = Math.min(start + pageSize, total.value);

    if (listInfo.value?.trackIds) {
      const trackIdsToLoad = listInfo.value.trackIds
        .slice(start, end)
        .map((item) => item.id)
        .filter((id) => !loadedIds.value.has(id));

      if (trackIdsToLoad.length > 0) {
        await loadSongs(trackIdsToLoad, true, false);
      }
    } else if (start < songList.value.length) {
      const newSongs = songList.value.slice(start, end);
      newSongs.forEach((song) => {
        if (!loadedIds.value.has(song.id)) {
          loadedIds.value.add(song.id);
          displayedSongs.value.push(song);
        }
      });
    }

    hasMore.value = displayedSongs.value.length < total.value;
  } catch (error) {
    console.error('加载更多歌曲失败:', error);
  } finally {
    isLoadingMore.value = false;
    loadingList.value = false;
  }
};

// 处理虚拟列表滚动事件
const handleVirtualScroll = (e: any) => {
  if (!e || !e.target) return;

  const { scrollTop, scrollHeight, clientHeight } = e.target;
  const threshold = 200;

  if (
    scrollHeight - scrollTop - clientHeight < threshold &&
    !isLoadingMore.value &&
    hasMore.value &&
    !searchKeyword.value // 搜索状态下不触发加载更多
  ) {
    loadMoreSongs();
  }
};

// 初始化歌曲列表
const initSongList = (songs: any[]) => {
  if (songs.length > 0) {
    displayedSongs.value = [...songs];
    songs.forEach((song) => loadedIds.value.add(song.id));
    page.value = Math.ceil(songs.length / pageSize);
  }

  // 检查是否还有更多数据可加载
  hasMore.value = displayedSongs.value.length < total.value;
};

watch(
  () => listInfo.value,
  (newListInfo) => {
    if (newListInfo?.trackIds) {
      loadFullPlaylist();
    }
  },
  { deep: true }
);

// 监听搜索关键词变化
watch(searchKeyword, () => {
  // 当搜索关键词为空时，考虑加载更多歌曲
  if (!searchKeyword.value && hasMore.value && displayedSongs.value.length < total.value) {
    loadMoreSongs();
  }
});

// 组件卸载时清理状态
onUnmounted(() => {
  isPlaylistLoading.value = false;
});

// 切换布局
const toggleLayout = () => {
  isCompactLayout.value = !isCompactLayout.value;
  localStorage.setItem('musicListLayout', isCompactLayout.value ? 'compact' : 'normal');
};

// 初始化歌单收藏状态
const checkCollectionStatus = async () => {
  if (route.query.type === 'playlist' && listInfo.value?.id) {
    canCollect.value = true;
    isCollected.value = musicStore.isCollectedPlaylist(listInfo.value.id);
  } else if (route.query.type === 'album' && listInfo.value?.id) {
    canCollect.value = true; // 专辑也可以收藏
    // 此处需要实现检查专辑是否已收藏的逻辑，例如 musicStore.isCollectedAlbum(listInfo.value.id)
    // 暂时设置为 false，后续需要您根据实际收藏逻辑添加
    isCollected.value = musicStore.isCollectedAlbum(listInfo.value.id); 
  } else {
    canCollect.value = false;
    isCollected.value = false;
  }
};

// 切换收藏状态
const toggleCollect = async () => {
  if (!canCollect.value || !listInfo.value?.id) return;

  const currentStatus = isCollected.value;
  const type = route.query.type as string;
  const id = listInfo.value.id;

  try {
    let success = false;
    if (type === 'playlist') {
      await subscribePlaylist({
        id: id,
        t: currentStatus ? 2 : 1 // 1: 收藏, 2: 取消收藏
      });
      musicStore.updatePlaylistCollection(id, !currentStatus);
      success = true;
    } else if (type === 'album') {
      // 调用收藏/取消收藏专辑的 API
      // 例如: await subscribeAlbum({ id: id, t: currentStatus ? 0 : 1 }); // API可能不同
      // 更新 store 中的专辑收藏状态: musicStore.updateAlbumCollection(id, !currentStatus);
      // 此处为示例，您需要替换为实际的API调用和store更新逻辑
      const res = await musicStore.toggleAlbumCollection(id, !currentStatus);
      if (res) success = true;
    }

    if (success) {
      isCollected.value = !currentStatus;
      message.success(currentStatus ? t('user.message.cancelCollectSuccess') : t('user.message.collectSuccess'));
    } else {
      message.error(currentStatus ? t('user.message.cancelCollectFail') : t('user.message.collectFail'));
    }
  } catch (error) {
    console.error('操作收藏失败:', error);
    message.error(t('user.message.actionFail'));
  }
};

// 播放全部
const handlePlayAll = () => {
  if (displayedSongs.value.length === 0) return;
  
  // 如果有搜索关键词，只播放过滤后的歌曲
  if (searchKeyword.value) {
    playerStore.setPlayList(filteredSongs.value.map(formatSong));
    playerStore.setPlay(formatSong(filteredSongs.value[0]));
    return;
  }
  
  // 否则播放全部歌曲
  // 使用setPlayList设置播放列表
  playerStore.setPlayList(displayedSongs.value.map(formatSong));
  // 使用setPlay开始播放第一首
  playerStore.setPlay(formatSong(displayedSongs.value[0]));
};

// 添加到播放列表末尾
const addToPlaylist = () => {
  if (displayedSongs.value.length === 0) return;
  
  // 获取当前播放列表
  const currentList = playerStore.playList;
  
  // 如果有搜索关键词，只添加过滤后的歌曲
  const songsToAdd = searchKeyword.value 
    ? filteredSongs.value 
    : displayedSongs.value;
  
  // 添加歌曲到播放列表(避免重复添加)
  const newSongs = songsToAdd.filter(song => 
    !currentList.some(item => item.id === song.id)
  );
  
  if (newSongs.length === 0) {
    message.info(t('comp.musicList.songsAlreadyInPlaylist'));
    return;
  }
  
  // 合并到当前播放列表末尾
  const newList = [...currentList, ...newSongs.map(formatSong)];
  playerStore.setPlayList(newList);
  
  message.success(t('comp.musicList.addToPlaylistSuccess', { count: newSongs.length }));
};
</script>

<style scoped lang="scss">
.music {
  &-title {
    @apply text-xl font-bold text-gray-900 dark:text-white;
  }

  &-total {
    @apply text-sm font-normal text-gray-500 dark:text-gray-400;
  }

  &-page {
    @apply h-full bg-light-100 dark:bg-dark-100 px-4 mr-2 rounded-2xl;
  }

  &-close {
    @apply cursor-pointer text-gray-500 dark:text-white hover:text-gray-900 dark:hover:text-gray-300 flex gap-2 items-center transition;
    .icon {
      @apply text-3xl;
    }
  }

  &-content {
    @apply flex h-[calc(100%-60px)];
  }

  &-info {
    @apply w-[25%] flex-shrink-0 pr-8 flex flex-col;

    .music-cover {
      @apply w-full aspect-square rounded-2xl overflow-hidden mb-4 min-h-[250px];
      .cover-img {
        @apply w-full h-full object-cover;
      }
    }

    .creator-info {
      @apply flex items-center mb-4;
      .creator-name {
        @apply ml-2 text-gray-700 dark:text-gray-300;
      }
    }

    .music-desc {
      @apply text-sm text-gray-600 dark:text-gray-400 leading-relaxed pr-4;
    }
  }

  &-list {
    @apply flex-grow min-h-0;
    &-container {
      @apply flex-grow min-h-0 flex flex-col relative;
    }

    &-content {
      @apply min-h-[calc(80vh-60px)];
    }
  }
}

.search-container {
  @apply max-w-md transition-all duration-300 ease-in-out;

  &.search-expanded {
    @apply w-52;
  }

  .search-button {
    @apply w-8 h-8 rounded-full flex items-center justify-center cursor-pointer hover:bg-light-300 dark:hover:bg-dark-300 transition-colors text-gray-500 dark:text-gray-400 hover:text-green-500;
    
    .icon {
      @apply text-lg;
    }
  }

  :deep(.n-input) {
    @apply bg-light-200 dark:bg-dark-200;
  }

}

.no-result {
  @apply text-center py-8 text-gray-500 dark:text-gray-400;
}

/* 虚拟列表样式 */
.song-virtual-list {
  :deep(.n-virtual-list__scroll) {
    scrollbar-width: thin;
    &::-webkit-scrollbar {
      width: 4px;
    }
    &::-webkit-scrollbar-thumb {
      @apply bg-gray-400 dark:bg-gray-600 rounded;
    }
  }
}

.mobile {
  .music-page {
    @apply px-4 overflow-hidden mr-0;
  }

  .music-content {
    @apply flex-col;
  }

  .music-info {
    @apply w-full pr-0 mb-2 flex flex-row;

    .music-cover {
      @apply w-[100px] h-[100px] rounded-lg overflow-hidden mb-4;
    }
    .music-detail {
      @apply flex-1 ml-4;
    }
  }

  .music-title {
    @apply text-base;
  }

  .search-container {
    @apply max-w-[50%];
  }
}

.loading-more {
  @apply text-center py-4 text-gray-500 dark:text-gray-400;
}

.double-item {
  @apply mb-2 bg-light-200 bg-opacity-30 dark:bg-dark-200 dark:bg-opacity-20 rounded-3xl;
}

.mobile {
  .music-info {
    @apply hidden;
  }
}

.layout-toggle {
  .toggle-button {
    @apply w-8 h-8 rounded-full flex items-center justify-center cursor-pointer hover:bg-light-300 dark:hover:bg-dark-300 transition-colors;
    
    .icon {
      @apply text-lg text-gray-500 dark:text-gray-400 transition-colors;
    }
  }
}

.layout-toggle .toggle-button,
.action-button {
  @apply w-8 h-8 rounded-full flex items-center justify-center cursor-pointer hover:bg-light-300 dark:hover:bg-dark-300 transition-colors text-gray-500 dark:text-gray-400;
  
  .icon {
    @apply text-lg;
  }

  &.collected {
    .icon {
      @apply text-red-500;
    }
  }
  
  &.hover-green:hover {
    .icon {
      @apply text-green-500;
    }
  }
}
</style> 