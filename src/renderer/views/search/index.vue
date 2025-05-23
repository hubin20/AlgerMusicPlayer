<template>
  <div class="search-page">
    <n-layout
      v-if="isMobile ? !searchDetail : true"
      class="hot-search"
      :class="setAnimationClass('animate__fadeInDown')"
      :native-scrollbar="false"
    >
      <div class="title">{{ t('search.title.hotSearch') }}</div>
      <div class="hot-search-list">
        <template v-for="(item, index) in hotSearchData?.data" :key="index">
          <div
            :class="setAnimationClass('animate__bounceInLeft')"
            :style="setAnimationDelay(index, 10)"
            class="hot-search-item"
            @click.stop="loadSearch(item.searchWord, 1)"
          >
            <span class="hot-search-item-count" :class="{ 'hot-search-item-count-3': index < 3 }">{{
              index + 1
            }}</span>
            {{ item.searchWord }}
          </div>
        </template>
      </div>
    </n-layout>
    <!-- 搜索到的歌曲列表 -->
    <n-layout
      v-if="isMobile ? searchDetail : true"
      class="search-list"
      :class="setAnimationClass('animate__fadeInDown')"
      :native-scrollbar="false"
      @scroll="handleScroll"
    >
      <div v-if="searchDetail" class="title">
        <i
          class="ri-arrow-left-s-line mr-1 cursor-pointer hover:text-gray-500 hover:scale-110"
          @click="searchDetail = null"
        ></i>
        {{ hotKeyword }}
        <div v-if="searchDetail?.songs?.length" class="title-play-all">
          <div class="play-all-btn" @click="handlePlayAll">
            <i class="ri-play-circle-fill"></i>
            <span>{{ t('search.button.playAll') }}</span>
          </div>
        </div>
      </div>
      <div v-loading="searchDetailLoading" class="search-list-box">
        <template v-if="searchDetail && (searchDetail.songs?.length || searchDetail.albums?.length || searchDetail.playlists?.length || searchDetail.mvs?.length || searchDetail.kwSongs?.length)">
          <!-- 优先显示网易云精确匹配类型的结果 -->
          <template v-if="searchType === SEARCH_TYPE.ALBUM && searchDetail.albums?.length">
            <div class="search-playlist-grid">
              <div
                v-for="(albumItem, index) in searchDetail.albums"
                :key="albumItem.id || index" 
                :class="setAnimationClass('animate__bounceInRight')" :style="getSearchListAnimation(index)"
              >
                <search-item :item="albumItem as any" shape="square" /> 
              </div>
            </div>
          </template>
          <template v-else-if="searchType === SEARCH_TYPE.PLAYLIST && searchDetail.playlists?.length">
            <div class="search-playlist-grid">
              <div
                v-for="(playlistItem, index) in searchDetail.playlists"
                :key="playlistItem.id || index"
                :class="setAnimationClass('animate__bounceInRight')" :style="getSearchListAnimation(index)"
              >
                <search-item :item="playlistItem as any" shape="square" />
              </div>
            </div>
          </template>
          <template v-else-if="searchType === SEARCH_TYPE.MV && searchDetail.mvs?.length">
            <div class="search-playlist-grid">
              <div
                v-for="(mvItem, index) in searchDetail.mvs"
                :key="mvItem.id || index" 
                :class="setAnimationClass('animate__bounceInRight')" :style="getSearchListAnimation(index)"
              >
                <search-item :item="mvItem as any" shape="square" />
              </div>
            </div>
          </template>
          <!-- 默认或单曲搜索时，显示歌曲列表 (可能包含网易云单曲和酷我歌曲) -->
          <template v-else-if="searchDetail.songs?.length">
            <div
              v-for="(item, index) in searchDetail.songs"
              :key="item.id || index" 
              :class="setAnimationClass('animate__bounceInRight')" :style="getSearchListAnimation(index)"
            >
              <song-item :item="item" @play="handlePlay" :is-next="true" />
            </div>
          </template>
          <!-- 如果主要搜索类型没有结果，但酷我歌曲有结果，可以考虑展示 (可选) -->
          <template v-else-if="searchDetail.kwSongs?.length">
             <div class="my-2 mx-4 text-sm text-gray-500">{{ t('search.title.kwSongsFallback') }}</div>
            <div
              v-for="(item, index) in searchDetail.kwSongs"
              :key="item.id || index" 
              :class="setAnimationClass('animate__bounceInRight')" :style="getSearchListAnimation(index)"
            >
              <song-item :item="item" @play="handlePlay" :is-next="true" />
            </div>
          </template>

          <!-- 加载状态 -->
          <div v-if="isLoadingMore" class="loading-more">
            <n-spin size="small" />
            <span class="ml-2">{{ t('search.loading.more') }}</span>
          </div>
          <div v-if="!hasMore && searchDetail" class="no-more">{{ t('search.noMore') }}</div>

        </template>
        <!-- 搜索历史 -->
        <template v-else>
          <div class="search-history">
            <div class="search-history-header title">
              <span>{{ t('search.title.searchHistory') }}</span>
              <n-button text type="error" @click="clearSearchHistory">
                <template #icon>
                  <i class="ri-delete-bin-line"></i>
                </template>
                {{ t('search.button.clear') }}
              </n-button>
            </div>
            <div class="search-history-list">
              <n-tag
                v-for="(item, index) in searchHistory"
                :key="index"
                :class="setAnimationClass('animate__bounceIn')"
                :style="getSearchListAnimation(index)"
                class="search-history-item"
                round
                closable
                @click="handleSearchHistory(item)"
                @close="handleCloseSearchHistory(item)"
              >
                {{ item.keyword }}
              </n-tag>
            </div>
          </div>
        </template>
      </div>
    </n-layout>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

import { getHotSearch } from '@/api/home';
import { getSearch } from '@/api/search';
import { searchKwMusic } from '@/api/kwmusic';
import SearchItem from '@/components/common/SearchItem.vue';
import SongItem from '@/components/common/SongItem.vue';
import { SEARCH_TYPE } from '@/const/bar-const';
import { usePlayerStore } from '@/store/modules/player';
import { useSearchStore } from '@/store/modules/search';
import type { IHotSearch, AlbumItem, PlaylistItem, MvItem } from '@/type/search';
import type { SongResult, Artist } from '@/type/music';
import { isMobile, setAnimationClass, setAnimationDelay, formatNumber, secondToMinute } from '@/utils';
import { NSpin, NButton, NTag } from 'naive-ui';

defineOptions({
  name: 'Search'
});

const { t } = useI18n();
const route = useRoute();
const playerStore = usePlayerStore();
const searchStore = useSearchStore();

const searchDetail = ref<{ songs: SongResult[]; albums: AlbumItem[]; playlists: PlaylistItem[]; mvs: MvItem[]; kwSongs: SongResult[]; } | null>(null);

const searchType = computed(() => searchStore.searchType as number);
const searchDetailLoading = ref(false);
const searchHistory = ref<Array<{ keyword: string; type: number }>>([]);

const ITEMS_PER_PAGE = 30;
const page = ref(0);
const hasMore = ref(true);
const isLoadingMore = ref(false);
const currentKeyword = ref('');

const getSearchListAnimation = (index: number) => {
  return setAnimationDelay(index % ITEMS_PER_PAGE, 50);
};

const loadSearchHistory = () => {
  const history = localStorage.getItem('searchHistory');
  searchHistory.value = history ? JSON.parse(history) : [];
};

const saveSearchHistory = (keyword: string, type: number) => {
  if (!keyword) return;
  const history = searchHistory.value;
  const index = history.findIndex((item) => item.keyword === keyword);
  if (index > -1) {
    history.splice(index, 1);
  }
  history.unshift({ keyword, type });
  if (history.length > 20) {
    history.pop();
  }
  searchHistory.value = history;
  localStorage.setItem('searchHistory', JSON.stringify(history));
};

const clearSearchHistory = () => {
  searchHistory.value = [];
  localStorage.removeItem('searchHistory');
};

const handleCloseSearchHistory = (item: { keyword: string; type: number }) => {
  searchHistory.value = searchHistory.value.filter((h) => h.keyword !== item.keyword);
  localStorage.setItem('searchHistory', JSON.stringify(searchHistory.value));
};

const hotSearchData = ref<IHotSearch>();
const loadHotSearch = async () => {
  const { data } = await getHotSearch();
  hotSearchData.value = data;
};

onMounted(() => {
  loadHotSearch();
  loadSearchHistory();
});

const hotKeyword = ref(route.query.keyword || t('search.title.searchList'));

const loadSearch = async (keywords: any, type: any = null, isLoadMore = false) => {
  if (!keywords) return;

  const searchTypeToUse = type !== null ? type : searchType.value;

  if (!isLoadMore) {
    hotKeyword.value = keywords;
    // 初始化 searchDetail 结构，所有类型的数组都为空
    searchDetail.value = { songs: [], albums: [], playlists: [], mvs: [], kwSongs: [] };
    page.value = 0;
    hasMore.value = true;
    currentKeyword.value = keywords;
    saveSearchHistory(keywords, searchTypeToUse);
    searchStore.searchType = searchTypeToUse;
    searchStore.searchValue = keywords;
  } else if (isLoadingMore.value || !hasMore.value) {
    return;
  }

  searchDetailLoading.value = !isLoadMore;
  isLoadingMore.value = isLoadMore;

  try {
    page.value++;
    let currentNeteaseHasMore = false;
    let currentKwHasMore = false; // 仅用于单曲

    // --- 单曲搜索逻辑分支 ---
    if (searchTypeToUse === SEARCH_TYPE.MUSIC) {
      const neteasePromise = getSearch({ keywords, type: SEARCH_TYPE.MUSIC, limit: ITEMS_PER_PAGE, offset: (page.value - 1) * ITEMS_PER_PAGE });
      const kwPromise = searchKwMusic(keywords, page.value, ITEMS_PER_PAGE, SEARCH_TYPE.MUSIC);
      const [neteaseRes, kwRes] = await Promise.allSettled([neteasePromise, kwPromise]);

      let neteaseSongs: SongResult[] = [];
      if (neteaseRes.status === 'fulfilled' && neteaseRes.value?.data?.result?.songs) {
        neteaseSongs = neteaseRes.value.data.result.songs.map((song: any): SongResult => {
          const artists = (song.ar || song.artists || []).map((a: any): Artist => ({
            id: a.id || 0, name: a.name || '未知歌手', picId: a.picId || 0, img1v1Id: a.img1v1Id || 0,
            briefDesc: a.briefDesc || '', picUrl: a.picUrl || '', img1v1Url: a.img1v1Url || '',
            albumSize: a.albumSize || 0, alias: a.alias || [], trans: a.trans || '',
            musicSize: a.musicSize || 0, topicPerson: a.topicPerson || 0,
          }));
          return {
            id: song.id, name: song.name,
            picUrl: song.al?.picUrl || song.album?.picUrl || song.al?.coverUrl || song.album?.coverUrl || '',
            duration: song.dt || song.duration || 0, artists: artists,
            album: {
              id: song.al?.id || song.album?.id || 0, name: song.al?.name || song.album?.name || '未知专辑',
              picUrl: song.al?.picUrl || song.album?.picUrl || song.al?.coverUrl || song.album?.coverUrl || '',
            },
            source: 'netease', type: 'music', privilege: song.privilege, fee: song.fee, sq: song.sq, hr: song.hr, pl: song.pl
          };
        });
        currentNeteaseHasMore = neteaseRes.value.data.result.songs.length === ITEMS_PER_PAGE;
      }

      let kwSongs: SongResult[] = [];
      if (kwRes.status === 'fulfilled' && kwRes.value && Array.isArray(kwRes.value)) {
        kwSongs = kwRes.value;
        currentKwHasMore = kwRes.value.length === ITEMS_PER_PAGE;
      }

      if (isLoadMore && searchDetail.value) {
        searchDetail.value.songs = [...searchDetail.value.songs, ...neteaseSongs, ...kwSongs].sort((_a, _b) => 0);
      } else {
        searchDetail.value = {
          songs: [...neteaseSongs, ...kwSongs].sort((_a, _b) => 0),
          albums: [], playlists: [], mvs: [], kwSongs: [] // 其他类型清空
        };
      }
      hasMore.value = currentNeteaseHasMore || currentKwHasMore;

    // --- 歌单搜索逻辑分支 ---
    } else if (searchTypeToUse === SEARCH_TYPE.PLAYLIST) {
      const neteaseRes = await getSearch({ keywords, type: SEARCH_TYPE.PLAYLIST, limit: ITEMS_PER_PAGE, offset: (page.value - 1) * ITEMS_PER_PAGE });
      let playlistsToSet: PlaylistItem[] = [];
      let songsFromPlaylist: SongResult[] = []; // 歌单API可能返回的歌曲

      if (neteaseRes?.data?.result?.playlists) {
        playlistsToSet = neteaseRes.data.result.playlists.map((pl: any): PlaylistItem => ({
          id: pl.id, name: pl.name, picUrl: pl.coverImgUrl || pl.picUrl,
          playCount: pl.playCount, trackCount: pl.trackCount,
          creator: pl.creator?.nickname || '未知创建者', type: 'playlist',
          desc: pl.description || `包含 ${pl.trackCount} 首歌`, source: 'netease'
        }));
        currentNeteaseHasMore = neteaseRes.data.result.playlists.length === ITEMS_PER_PAGE;
        
        // 假设网易云歌单搜索结果中不直接内嵌歌曲列表，如果需要，需额外逻辑获取
        // 如果API确实在playlist搜索结果中也返回了songs (如neteaseRes.data.result.songs)
        // 则需要像下面专辑分支一样处理 songsFromPlaylist
      }

      if (isLoadMore && searchDetail.value) {
        searchDetail.value.playlists = [...searchDetail.value.playlists, ...playlistsToSet];
        // searchDetail.value.songs = [...searchDetail.value.songs, ...songsFromPlaylist]; // 如果有附带歌曲
      } else {
        searchDetail.value = {
          songs: songsFromPlaylist, // 歌单附带的歌曲
          albums: [], playlists: playlistsToSet, mvs: [], kwSongs: [] // 其他类型清空
        };
      }
      hasMore.value = currentNeteaseHasMore;

    // --- 专辑搜索逻辑分支 ---
    } else if (searchTypeToUse === SEARCH_TYPE.ALBUM) {
      const neteaseRes = await getSearch({ keywords, type: SEARCH_TYPE.ALBUM, limit: ITEMS_PER_PAGE, offset: (page.value - 1) * ITEMS_PER_PAGE });
      let albumsToSet: AlbumItem[] = [];
      let songsFromAlbum: SongResult[] = []; // 专辑API可能返回的歌曲

      if (neteaseRes?.data?.result?.albums) {
        albumsToSet = neteaseRes.data.result.albums.map((al: any): AlbumItem => ({
          id: al.id, name: al.name, picUrl: al.picUrl,
          artistName: al.artist?.name || (al.artists && al.artists[0]?.name) || '未知艺术家',
          artists: al.artists || (al.artist ? [al.artist] : []),
          size: al.size, publishTime: al.publishTime, company: al.company, type: 'album',
          desc: al.company || `艺人: ${al.artist?.name || (al.artists && al.artists[0]?.name) || '未知'}`,
          source: 'netease'
        }));
        currentNeteaseHasMore = neteaseRes.data.result.albums.length === ITEMS_PER_PAGE;

        // 处理专辑搜索时API可能附带的歌曲
        if (neteaseRes.data.result.songs) {
          songsFromAlbum = neteaseRes.data.result.songs.map((song: any): SongResult => {
            const artists = (song.ar || song.artists || []).map((a: any): Artist => ({
              id: a.id || 0, name: a.name || '未知歌手', picId: a.picId || 0, img1v1Id: a.img1v1Id || 0,
              briefDesc: a.briefDesc || '', picUrl: a.picUrl || '', img1v1Url: a.img1v1Url || '',
              albumSize: a.albumSize || 0, alias: a.alias || [], trans: a.trans || '',
              musicSize: a.musicSize || 0, topicPerson: a.topicPerson || 0,
            }));
            return {
              id: song.id, name: song.name,
              picUrl: song.al?.picUrl || song.album?.picUrl || song.al?.coverUrl || song.album?.coverUrl || '',
              duration: song.dt || song.duration || 0, artists: artists,
              album: { // 这里album是歌曲所属的专辑，与当前搜索的专辑对象区分
                id: song.al?.id || song.album?.id || 0, name: song.al?.name || song.album?.name || '未知专辑',
                picUrl: song.al?.picUrl || song.album?.picUrl || song.al?.coverUrl || song.album?.coverUrl || '',
              },
              source: 'netease', type: 'music', privilege: song.privilege, fee: song.fee, sq: song.sq, hr: song.hr, pl: song.pl
            };
          });
        }
      }

      if (isLoadMore && searchDetail.value) {
        searchDetail.value.albums = [...searchDetail.value.albums, ...albumsToSet];
        searchDetail.value.songs = [...searchDetail.value.songs, ...songsFromAlbum];
      } else {
        searchDetail.value = {
          songs: songsFromAlbum, // 专辑附带的歌曲
          albums: albumsToSet, playlists: [], mvs: [], kwSongs: [] // 其他类型清空
        };
      }
      hasMore.value = currentNeteaseHasMore;

    // --- MV 搜索逻辑分支 ---
    } else if (searchTypeToUse === SEARCH_TYPE.MV) {
      const neteaseRes = await getSearch({ keywords, type: SEARCH_TYPE.MV, limit: ITEMS_PER_PAGE, offset: (page.value - 1) * ITEMS_PER_PAGE });
      let mvsToSet: MvItem[] = [];

      if (neteaseRes?.data?.result?.mvs) {
        mvsToSet = neteaseRes.data.result.mvs.map((mv: any): MvItem => {
          const durationInSeconds = Math.round(mv.duration / 1000);
          return {
            id: mv.id, name: mv.name, cover: mv.cover, picUrl: mv.cover,
            artistName: mv.artistName, artists: mv.artists, playCount: mv.playCount,
            duration: mv.duration, type: 'mv',
            desc: `${mv.artistName || '未知艺人'} · ${secondToMinute(durationInSeconds)}`,
            source: 'netease'
          };
        });
        currentNeteaseHasMore = neteaseRes.data.result.mvs.length === ITEMS_PER_PAGE;
      }

      if (isLoadMore && searchDetail.value) {
        searchDetail.value.mvs = [...searchDetail.value.mvs, ...mvsToSet];
      } else {
        searchDetail.value = {
          songs: [], albums: [], playlists: [], mvs: mvsToSet, kwSongs: [] // 其他类型清空
        };
      }
      hasMore.value = currentNeteaseHasMore;
    }
    // --- 其他未知类型，可以加一个默认处理或错误提示 ---
    else {
        console.warn('未知的搜索类型:', searchTypeToUse);
        if (!isLoadMore && searchDetail.value) { // 确保 searchDetail 已初始化
            searchDetail.value = { songs: [], albums: [], playlists: [], mvs: [], kwSongs: [] };
        }
        hasMore.value = false;
    }

  } catch (e) {
    console.error('搜索失败:', e);
    if (!isLoadMore) {
      searchDetail.value = { songs: [], albums: [], playlists: [], mvs: [], kwSongs: [] };
    }
    hasMore.value = false;
  } finally {
    searchDetailLoading.value = false;
    isLoadingMore.value = false;
  }
};

watch(
  () => searchStore.searchValue,
  (value, oldValue) => {
    if (value && value !== oldValue) {
      loadSearch(value, searchStore.searchType, false);
    }
  }
);

watch(
  () => searchType.value,
  (newType, oldType) => {
    if (newType !== oldType && searchStore.searchValue) {
      loadSearch(searchStore.searchValue, newType, false);
    }
  }
);

watch(
  () => route.query,
  (newQuery, oldQuery) => {
    const isFirstRun = oldQuery === undefined;
    const currentKeyword = newQuery.keyword as string;
    const currentType = newQuery.type ? Number(newQuery.type) : (searchStore.searchType || SEARCH_TYPE.MUSIC);

    if (route.name === 'Search') {
      if (currentKeyword) {
        // 更新store中的值
        searchStore.searchValue = currentKeyword;
        searchStore.searchType = currentType;

        if (isFirstRun) {
          // 首次运行且有关键词，直接加载
          loadSearch(currentKeyword, currentType, false);
        } else {
          // 非首次运行，检查关键词或类型是否真的变化了
          const keywordActuallyChanged = currentKeyword !== (oldQuery.keyword as string);
          const oldTypeFromQuery = oldQuery.type ? Number(oldQuery.type) : (searchStore.searchType || SEARCH_TYPE.MUSIC); // 获取旧类型的方式应与新类型一致
          const typeActuallyChanged = currentType !== oldTypeFromQuery;

          if (keywordActuallyChanged || typeActuallyChanged) {
            loadSearch(currentKeyword, currentType, false);
          } else if (!searchDetail.value || Object.values(searchDetail.value).every(arr => arr.length === 0)) {
            // 兼容刷新时，query未变但数据为空的情况 (例如从store加载失败或被清除)
            loadSearch(currentKeyword, currentType, false);
          }
        }
      } else {
        // 没有关键词 (例如从侧边栏点击搜索直接进入)
        searchDetail.value = { songs: [], albums: [], playlists: [], mvs: [], kwSongs: [] };
        hotKeyword.value = t('search.title.searchList');
        searchStore.searchValue = ''; // 清空store中的搜索词
        // 保留当前的搜索类型 searchStore.searchType 不变
      }
    }
  },
  { immediate: true, deep: true }
);

const handleScroll = (e: any) => {
  const { scrollTop, scrollHeight, clientHeight } = e.target;
  if (scrollTop + clientHeight >= scrollHeight - 100 && !isLoadingMore.value && hasMore.value) {
    loadSearch(currentKeyword.value, searchType.value, true);
  }
};

const handlePlay = (item: SongResult) => {
  playerStore.addToNextPlay(item);
};

const handleSearchHistory = (item: { keyword: string; type: number }) => {
  searchStore.searchType = item.type;
  searchStore.searchValue = item.keyword;
};

const handlePlayAll = () => {
  if (!searchDetail.value?.songs?.length) return;
  playerStore.setPlayList(searchDetail.value.songs);
  if (searchDetail.value.songs[0]) {
    playerStore.setPlay(searchDetail.value.songs[0]);
  }
};
</script>

<style lang="scss" scoped>
.search-page {
  @apply flex h-full;
}

.hot-search {
  @apply mr-4 rounded-xl flex-1 overflow-hidden;
  @apply bg-light-100 dark:bg-dark-100;
  animation-duration: 0.2s;
  min-width: 400px;
  height: 100%;

  &-list {
    @apply pb-28;
  }

  &-item {
    @apply px-4 py-3 text-lg rounded-xl cursor-pointer;
    @apply text-gray-900 dark:text-white;
    transition: all 0.3s ease;

    &:hover {
      @apply bg-light-100 dark:bg-dark-200;
    }

    &-count {
      @apply inline-block ml-3 w-8;
      @apply text-green-500;

      &-3 {
        @apply font-bold inline-block ml-3 w-8;
        @apply text-red-500;
      }
    }
  }
}

.search-list {
  @apply flex-1 rounded-xl;
  @apply bg-light-100 dark:bg-dark-100;
  height: 100%;
  animation-duration: 0.2s;

  &-box {
    @apply pb-28;
  }
}

.title {
  @apply text-xl font-bold my-2 mx-4 flex items-center;
  @apply text-gray-900 dark:text-white;
  
  &-play-all {
    @apply ml-auto;
  }
}

.play-all-btn {
  @apply flex items-center gap-1 px-3 py-1 rounded-full cursor-pointer transition-all;
  @apply text-sm font-normal text-gray-900 dark:text-white hover:bg-light-300 dark:hover:bg-dark-300 hover:text-green-500;
  
  i {
    @apply text-xl;
  }
}

.search-history {
  &-header {
    @apply flex justify-between items-center mb-4;
    @apply text-gray-900 dark:text-white;
  }

  &-list {
    @apply flex flex-wrap gap-2 px-4;
  }

  &-item {
    @apply cursor-pointer;
    animation-duration: 0.2s;
  }
}

.mobile {
  .hot-search {
    @apply mr-0 w-full;
  }
}

.loading-more {
  @apply flex justify-center items-center py-4;
  @apply text-gray-500 dark:text-gray-400;
}

.no-more {
  @apply text-center py-4;
  @apply text-gray-500 dark:text-gray-400;
}

.search-list-box {
  @apply pt-4;
}

.search-playlist-grid {
  @apply grid gap-x-5 gap-y-5 px-4; /* 调整了gap和padding以适应搜索页 */
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
}
</style>
