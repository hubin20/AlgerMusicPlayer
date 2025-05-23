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
            <div
              v-for="(albumItem, index) in searchDetail.albums"
              :key="albumItem.id || index" class="mb-3"
              :class="setAnimationClass('animate__bounceInRight')" :style="getSearchListAnimation(index)"
            >
              <search-item :item="albumItem as any" shape="square" /> 
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
            <div
              v-for="(mvItem, index) in searchDetail.mvs"
              :key="mvItem.id || index" class="mb-3"
              :class="setAnimationClass('animate__bounceInRight')" :style="getSearchListAnimation(index)"
            >
              <search-item :item="mvItem as any" shape="rectangle" />
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
import { isMobile, setAnimationClass, setAnimationDelay } from '@/utils';
import { NSpin, NButton, NTag } from 'naive-ui';

defineOptions({
  name: 'Search'
});

const { t } = useI18n();
const route = useRoute();
const playerStore = usePlayerStore();
const searchStore = useSearchStore();

const searchDetail = ref<{
  songs: SongResult[];
  albums: AlbumItem[]; 
  playlists: PlaylistItem[]; 
  mvs: MvItem[]; 
  kwSongs: SongResult[];
} | null>(null);

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

    const neteasePromise = getSearch({
      keywords,
      type: searchTypeToUse,
      limit: ITEMS_PER_PAGE,
      offset: (page.value - 1) * ITEMS_PER_PAGE
    });

    // 仅当搜索类型为单曲时，才同时请求酷我歌曲
    const kwSongsPromise = searchTypeToUse === SEARCH_TYPE.MUSIC 
      ? searchKwMusic(keywords, page.value, ITEMS_PER_PAGE, searchTypeToUse)
      : Promise.resolve([]); // 其他类型则返回空数组

    const [neteaseRes, kwRes] = await Promise.allSettled([neteasePromise, kwSongsPromise]);

    let neteaseSongs: SongResult[] = [];
    let neteaseAlbums: AlbumItem[] = [];
    let neteasePlaylists: PlaylistItem[] = [];
    let neteaseMvs: MvItem[] = [];
    let kwSongsResult: SongResult[] = [];

    let currentNeteaseHasMore = false;
    let currentKwHasMore = false;

    if (neteaseRes.status === 'fulfilled' && neteaseRes.value?.data?.result) {
      const neteaseResult = neteaseRes.value.data.result;
      if (searchTypeToUse === SEARCH_TYPE.MUSIC && neteaseResult.songs) {
        // 保留原始的 SongResult 结构给单曲搜索
        neteaseSongs = neteaseResult.songs.map((song: any): SongResult => {
          const artists = (song.ar || song.artists || []).map((a: any): Artist => ({
            id: a.id || 0, name: a.name || '未知歌手', picId: a.picId || 0, img1v1Id: a.img1v1Id || 0,
            briefDesc: a.briefDesc || '', picUrl: a.picUrl || '', img1v1Url: a.img1v1Url || '',
            albumSize: a.albumSize || 0, alias: a.alias || [], trans: a.trans || '',
            musicSize: a.musicSize || 0, topicPerson: a.topicPerson || 0,
          }));
          const albumData = song.al || song.album || {};
          const fallbackArtist: Artist = { id: 0, name: '未知歌手', picUrl: '', alias: [], briefDesc: '', albumSize: 0, musicSize: 0, topicPerson: 0, img1v1Id: 0, img1v1Url: '', trans: '' , picId: 0 };
          return {
            id: song.id,
            name: song.name,
            ar: artists, // 保留 ar
            artists: artists, // 保留 artists
            al: { // 保留 al 结构
              id: albumData.id || 0, name: albumData.name || '未知专辑', picUrl: albumData.picUrl || '',
              type: albumData.type || '', size: albumData.size || 0, picId: albumData.picId || 0,
              blurPicUrl: albumData.blurPicUrl || '', companyId: albumData.companyId || 0,
              pic: albumData.pic || 0, publishTime: albumData.publishTime || 0,
              description: albumData.description || '', tags: albumData.tags || '',
              company: albumData.company || '', briefDesc: albumData.briefDesc || '',
              artist: artists[0] || fallbackArtist, songs: albumData.songs || [],
              alias: albumData.alias || [], status: albumData.status || 0,
              copyrightId: albumData.copyrightId || 0, commentThreadId: albumData.commentThreadId || '',
              artists: artists, subType: albumData.subType || '', transName: albumData.transName || '',
              onSale: albumData.onSale || false, mark: albumData.mark || 0,
              picId_str: albumData.picId_str || albumData.pic_str || ''
            },
            album: { // 保留 album 结构
              id: albumData.id || 0, name: albumData.name || '未知专辑', picUrl: albumData.picUrl || '',
              type: albumData.type || '', size: albumData.size || 0, picId: albumData.picId || 0,
              blurPicUrl: albumData.blurPicUrl || '', companyId: albumData.companyId || 0,
              pic: albumData.pic || 0, publishTime: albumData.publishTime || 0,
              description: albumData.description || '', tags: albumData.tags || '',
              company: albumData.company || '', briefDesc: albumData.briefDesc || '',
              artist: artists[0] || fallbackArtist, songs: albumData.songs || [],
              alias: albumData.alias || [], status: albumData.status || 0,
              copyrightId: albumData.copyrightId || 0, commentThreadId: albumData.commentThreadId || '',
              artists: artists, subType: albumData.subType || '', transName: albumData.transName || '',
              onSale: albumData.onSale || false, mark: albumData.mark || 0,
              picId_str: albumData.picId_str || albumData.pic_str || ''
            },
            picUrl: albumData.picUrl || '', // 保留 picUrl
            dt: song.dt || 0, // 保留 dt
            duration: song.dt || 0, // 保留 duration
            source: 'netease',
            count: 0, // 保留 count
          };
        });
        currentNeteaseHasMore = neteaseResult.songs.length === ITEMS_PER_PAGE;
      } else if (searchTypeToUse === SEARCH_TYPE.ALBUM && neteaseResult.albums) {
        neteaseAlbums = neteaseResult.albums.map((album: any): AlbumItem => ({
          id: album.id,
          name: album.name,
          picUrl: album.picUrl || album.blurPicUrl || 'assets/default_album_cover.png',
          artistName: album.artist?.name || (album.artists && album.artists[0]?.name) || '未知艺术家',
          artist: album.artist || (album.artists && album.artists[0]),
          size: album.size,
          publishTime: album.publishTime,
          source: 'netease',
          type: 'album', // 使用小写 'album'
          desc: album.artist?.name || (album.artists && album.artists[0]?.name) || t('search.unknownAlbumDesc')
        }));
        currentNeteaseHasMore = neteaseResult.albums.length === ITEMS_PER_PAGE;
      } else if (searchTypeToUse === SEARCH_TYPE.PLAYLIST && neteaseResult.playlists) {
        neteasePlaylists = neteaseResult.playlists.map((playlist: any): PlaylistItem => ({
          id: playlist.id,
          name: playlist.name,
          picUrl: playlist.coverImgUrl || 'assets/default_playlist_cover.png',
          playCount: playlist.playCount,
          trackCount: playlist.trackCount,
          creator: playlist.creator,
          source: 'netease',
          type: 'playlist', // 使用小写 'playlist'
          desc: playlist.creator?.nickname || t('search.unknownPlaylistDesc')
        }));
        currentNeteaseHasMore = neteaseResult.playlists.length === ITEMS_PER_PAGE;
      } else if (searchTypeToUse === SEARCH_TYPE.MV && neteaseResult.mvs) {
        neteaseMvs = neteaseResult.mvs.map((mv: any): MvItem => ({
          id: mv.id,
          name: mv.name,
          picUrl: mv.coverUrl || mv.imgurl || mv.cover || 'assets/default_mv_cover.png',
          artistName: mv.artistName,
          artists: mv.artists,
          playCount: mv.playCount,
          duration: mv.duration,
          publishTime: mv.publishTime,
          source: 'netease',
          type: 'mv', // 使用小写 'mv'
          desc: mv.artistName || mv.name || t('search.unknownMvDesc')
        }));
        currentNeteaseHasMore = neteaseResult.mvs.length === ITEMS_PER_PAGE;
      } else if (neteaseResult.songs && searchTypeToUse !== SEARCH_TYPE.MUSIC) {
        neteaseSongs = neteaseResult.songs.map((song: any): SongResult => {
          const artists = (song.ar || song.artists || []).map((a: any): Artist => ({
            id: a.id || 0, name: a.name || '未知歌手', picId: a.picId || 0, img1v1Id: a.img1v1Id || 0,
            briefDesc: a.briefDesc || '', picUrl: a.picUrl || '', img1v1Url: a.img1v1Url || '',
            albumSize: a.albumSize || 0, alias: a.alias || [], trans: a.trans || '',
            musicSize: a.musicSize || 0, topicPerson: a.topicPerson || 0,
          }));
          return {
            id: song.id,
            name: song.name,
            picUrl: song.al?.picUrl || song.album?.picUrl || '',
            song: {
              artists,
              album: {
                id: song.al?.id || song.album?.id || 0,
                name: song.al?.name || song.album?.name || '',
                picUrl: song.al?.picUrl || song.album?.picUrl || ''
              },
              duration: song.dt || song.duration || 0,
              id: song.id
            },
            artists,
            album: song.al || song.album,
            duration: song.dt || song.duration,
            source: 'netease', // 标记来源为网易云
            type: 'music'
          } as SongResult;
        });
        currentNeteaseHasMore = neteaseResult.songs.length === ITEMS_PER_PAGE;
      }
    } else if (neteaseRes.status === 'fulfilled' && !neteaseRes.value?.data?.result) {
      console.warn('Netease API success but no result data received.');
    }

    if (kwRes.status === 'fulfilled' && kwRes.value && Array.isArray(kwRes.value)) {
      kwSongsResult = kwRes.value;
      currentKwHasMore = kwSongsResult.length === ITEMS_PER_PAGE;
    }

    if (isLoadMore) {
      if (searchDetail.value) { // Add null check
        if (searchTypeToUse === SEARCH_TYPE.MUSIC) {
          searchDetail.value.songs = [...searchDetail.value.songs, ...neteaseSongs, ...kwSongsResult].sort((_a, _b) => 0);
        } else if (searchTypeToUse === SEARCH_TYPE.ALBUM) {
          searchDetail.value.albums = [...searchDetail.value.albums, ...neteaseAlbums];
        } else if (searchTypeToUse === SEARCH_TYPE.PLAYLIST) {
          searchDetail.value.playlists = [...searchDetail.value.playlists, ...neteasePlaylists];
        } else if (searchTypeToUse === SEARCH_TYPE.MV) {
          searchDetail.value.mvs = [...searchDetail.value.mvs, ...neteaseMvs];
        }
        // For non-music types, kwSongs and neteaseSongs (if any) are appended to their respective general lists if they exist.
        if (searchTypeToUse !== SEARCH_TYPE.MUSIC) {
          if (kwSongsResult.length > 0) {
             searchDetail.value.kwSongs = [...searchDetail.value.kwSongs, ...kwSongsResult];
          }
          if (neteaseSongs.length > 0) {
              searchDetail.value.songs = [...searchDetail.value.songs, ...neteaseSongs];
          }
        }
      }
    } else {
      // Not loadMore: Initialize searchDetail based on searchTypeToUse
      if (searchTypeToUse === SEARCH_TYPE.MUSIC) {
        searchDetail.value = {
          songs: [...neteaseSongs, ...kwSongsResult].sort((_a, _b) => 0),
          albums: [],
          playlists: [],
          mvs: [],
          kwSongs: [] // kwSongs are merged into songs for MUSIC type
        };
      } else if (searchTypeToUse === SEARCH_TYPE.ALBUM) {
        searchDetail.value = {
          songs: neteaseSongs, // Keep other netease songs if API returns them
          albums: neteaseAlbums,
          playlists: [],
          mvs: [],
          kwSongs: kwSongsResult
        };
      } else if (searchTypeToUse === SEARCH_TYPE.PLAYLIST) {
        searchDetail.value = {
          songs: neteaseSongs,
          albums: [],
          playlists: neteasePlaylists,
          mvs: [],
          kwSongs: kwSongsResult
        };
      } else if (searchTypeToUse === SEARCH_TYPE.MV) {
        searchDetail.value = {
          songs: neteaseSongs,
          albums: [],
          playlists: [],
          mvs: neteaseMvs,
          kwSongs: kwSongsResult
        };
      } else {
        // Fallback or general case if a specific type isn't matched
        searchDetail.value = {
          songs: neteaseSongs,
          albums: neteaseAlbums,
          playlists: neteasePlaylists,
          mvs: neteaseMvs,
          kwSongs: kwSongsResult
        };
      }
    }

    hasMore.value = currentNeteaseHasMore || currentKwHasMore;

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
  (value) => {
    if (value) loadSearch(value, searchStore.searchType, false);
  }
);

watch(
  () => searchType.value,
  (newType) => {
    if (searchStore.searchValue) {
      loadSearch(searchStore.searchValue, newType, false);
    }
  }
);

if (route.query.keyword && route.name === 'Search') {
  const typeFromQuery = route.query.type ? Number(route.query.type) : searchStore.searchType;
  loadSearch(route.query.keyword as string, typeFromQuery, false);
} else if (searchStore.searchValue && route.name === 'Search') {
    loadSearch(searchStore.searchValue, searchStore.searchType, false);
}

const handleScroll = (e: any) => {
  const { scrollTop, scrollHeight, clientHeight } = e.target;
  if (scrollTop + clientHeight >= scrollHeight - 100 && !isLoadingMore.value && hasMore.value) {
    loadSearch(currentKeyword.value, searchType.value, true);
  }
};

watch(
  () => route.query,
  (newQuery) => {
    if (newQuery.keyword && route.name === 'Search') {
      const typeFromQuery = newQuery.type ? Number(newQuery.type) : searchStore.searchType;
      searchStore.searchType = typeFromQuery;
      searchStore.searchValue = newQuery.keyword as string;
    } else if (route.name === 'Search' && !newQuery.keyword) {
      searchDetail.value = { songs: [], albums: [], playlists: [], mvs: [], kwSongs: [] };
      hotKeyword.value = t('search.title.searchList');
    }
  },
  { immediate: true, deep: true }
);

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
