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
              <search-item :item="albumItem" shape="square" /> 
            </div>
          </template>
          <template v-else-if="searchType === SEARCH_TYPE.PLAYLIST && searchDetail.playlists?.length">
            <div
              v-for="(playlistItem, index) in searchDetail.playlists"
              :key="playlistItem.id || index" class="mb-3"
              :class="setAnimationClass('animate__bounceInRight')" :style="getSearchListAnimation(index)"
            >
              <search-item :item="playlistItem" shape="square" />
            </div>
          </template>
          <template v-else-if="searchType === SEARCH_TYPE.MV && searchDetail.mvs?.length">
            <div
              v-for="(mvItem, index) in searchDetail.mvs"
              :key="mvItem.id || index" class="mb-3"
              :class="setAnimationClass('animate__bounceInRight')" :style="getSearchListAnimation(index)"
            >
              <search-item :item="mvItem" shape="rectangle" />
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
import { useDateFormat } from '@vueuse/core';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

// import { getBilibiliProxyUrl, searchBilibili } from '@/api/bilibili';
import { getHotSearch } from '@/api/home';
import { getSearch } from '@/api/search';
import { searchKwMusic } from '@/api/kwmusic';
// import BilibiliItem from '@/components/common/BilibiliItem.vue';
import SearchItem from '@/components/common/SearchItem.vue';
import SongItem from '@/components/common/SongItem.vue';
import { SEARCH_TYPE } from '@/const/bar-const';
import { usePlayerStore } from '@/store/modules/player';
import { useSearchStore } from '@/store/modules/search';
import type { IHotSearch, AlbumItem, PlaylistItem, MvItem } from '@/type/search';
// import type { IBilibiliSearchResult } from '@/types/bilibili';
import type { SongResult } from '@/type/music';
import { isMobile, setAnimationClass, setAnimationDelay } from '@/utils';

defineOptions({
  name: 'Search'
});

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const playerStore = usePlayerStore();
const searchStore = useSearchStore();

// const searchDetail = ref<any>();
const searchDetail = ref<{
  songs: SongResult[];
  albums: AlbumItem[]; 
  playlists: PlaylistItem[]; 
  mvs: MvItem[]; 
  kwSongs: SongResult[];
}>({
  songs: [],
  albums: [],
  playlists: [],
  mvs: [],
  kwSongs: []
});

const searchType = computed(() => searchStore.searchType as number);
const searchDetailLoading = ref(false);
const searchHistory = ref<Array<{ keyword: string; type: number }>>([]);

// 添加分页相关的状态
const ITEMS_PER_PAGE = 30; // 每页数量
const page = ref(0);
const hasMore = ref(true);
const isLoadingMore = ref(false);
const currentKeyword = ref('');

const getSearchListAnimation = (index: number) => {
  return setAnimationDelay(index % ITEMS_PER_PAGE, 50);
};

// 从 localStorage 加载搜索历史
const loadSearchHistory = () => {
  const history = localStorage.getItem('searchHistory');
  searchHistory.value = history ? JSON.parse(history) : [];
};

// 保存搜索历史，改为保存关键词和类型
const saveSearchHistory = (keyword: string, type: number) => {
  if (!keyword) return;
  const history = searchHistory.value;
  // 移除重复的关键词
  const index = history.findIndex((item) => item.keyword === keyword);
  if (index > -1) {
    history.splice(index, 1);
  }
  // 添加到开头
  history.unshift({ keyword, type });
  // 只保留最近的20条记录
  if (history.length > 20) {
    history.pop();
  }
  searchHistory.value = history;
  localStorage.setItem('searchHistory', JSON.stringify(history));
};

// 清空搜索历史
const clearSearchHistory = () => {
  searchHistory.value = [];
  localStorage.removeItem('searchHistory');
};

// 删除搜索历史
const handleCloseSearchHistory = (item: { keyword: string; type: number }) => {
  searchHistory.value = searchHistory.value.filter((h) => h.keyword !== item.keyword);
  localStorage.setItem('searchHistory', JSON.stringify(searchHistory.value));
};

// 热搜列表
const hotSearchData = ref<IHotSearch>();
const loadHotSearch = async () => {
  const { data } = await getHotSearch();
  hotSearchData.value = data;
};

onMounted(() => {
  loadHotSearch();
  loadSearchHistory();
  // 注意：路由参数的处理已经在 watch route.query 中处理了
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

    searchDetailLoading.value = true;
  isLoadingMore.value = isLoadMore;

  try {
    page.value++;

    const neteasePromise = getSearch({
      keywords,
      type: searchTypeToUse,
      limit: ITEMS_PER_PAGE,
      offset: (page.value - 1) * ITEMS_PER_PAGE
    });
    const kwPromise = searchKwMusic(keywords, page.value, ITEMS_PER_PAGE, searchTypeToUse);

    const [neteaseRes, kwRes] = await Promise.allSettled([neteasePromise, kwPromise]);

    let combinedSongs: any[] = [];
    let neteaseSongs: any[] = [];
    let kwSongsResult: any[] = [];
    let currentNeteaseHasMore = false;
    let currentKwHasMore = false;

    if (neteaseRes.status === 'fulfilled' && neteaseRes.value?.data) {
      const neteaseResult = neteaseRes.value.data.result;
      if (searchTypeToUse === SEARCH_TYPE.MUSIC && neteaseResult && neteaseResult.songs) {
        const mappedNeteaseSongs = neteaseResult.songs.map((song: any): SongResult => {
          return {
            id: song.id,
            name: song.name,
            ar: song.ar?.map((a: any) => ({ id: a.id, name: a.name })) || [],
            artists: song.artists?.map((a: any) => ({ id: a.id, name: a.name })) || [],
            al: {
              id: song.al?.id,
              name: song.al?.name,
              picUrl: song.al?.picUrl,
              pic_str: song.al?.pic_str,
              pic: song.al?.pic
            },
            picUrl: song.al?.picUrl,
            dt: song.dt,
            source: 'netease'
          };
        });
        neteaseSongs = mappedNeteaseSongs;
        currentNeteaseHasMore = neteaseResult.songs.length === ITEMS_PER_PAGE;
      } else if (searchTypeToUse === SEARCH_TYPE.ALBUM && neteaseResult && neteaseResult.albums) {
        const mappedNeteaseAlbums = neteaseResult.albums.map((album: any): AlbumItem => ({
          id: album.id,
          name: album.name,
          picUrl: album.picUrl || album.blurPicUrl,
          artist: album.artist, 
          artists: album.artists, 
          artistName: album.artist?.name,
          publishTime: album.publishTime,
          size: album.size, 
          company: album.company,
          source: 'netease',
          type: '专辑', 
          desc: album.artist?.name || '' 
        }));
        if (isLoadMore) {
          searchDetail.value.albums = [...(searchDetail.value.albums || []), ...mappedNeteaseAlbums];
        } else {
          searchDetail.value.albums = mappedNeteaseAlbums;
        }
        currentNeteaseHasMore = neteaseResult.albums.length === ITEMS_PER_PAGE;
      } else if (searchTypeToUse === SEARCH_TYPE.PLAYLIST && neteaseResult && neteaseResult.playlists) {
        const mappedNeteasePlaylists = neteaseResult.playlists.map((playlist: any): PlaylistItem => ({
          id: playlist.id,
          name: playlist.name,
          coverImgUrl: playlist.coverImgUrl, 
          picUrl: playlist.coverImgUrl, 
          trackCount: playlist.trackCount,
          playCount: playlist.playCount,
          creator: playlist.creator, 
          description: playlist.description, 
          desc: playlist.creator?.nickname || playlist.description?.substring(0,50) || '', 
          bookCount: playlist.subscribedCount,
          source: 'netease',
          type: 'playlist' 
        }));
        if (isLoadMore) {
          searchDetail.value.playlists = [...(searchDetail.value.playlists || []), ...mappedNeteasePlaylists];
        } else {
          searchDetail.value.playlists = mappedNeteasePlaylists;
        }
        currentNeteaseHasMore = neteaseResult.playlists.length === ITEMS_PER_PAGE;
      } else if (searchTypeToUse === SEARCH_TYPE.MV && neteaseResult && neteaseResult.mvs) {
        const mappedNeteaseMvs = neteaseResult.mvs.map((mv: any): MvItem => ({
          id: mv.id,
          name: mv.name,
          cover: mv.coverUrl || mv.imgurl || mv.cover,
          picUrl: mv.coverUrl || mv.imgurl || mv.cover, 
          artistName: mv.artistName,
          artists: mv.artists,
          playCount: mv.playCount,
          duration: mv.duration,
          publishTime: mv.publishTime,
          source: 'netease',
          type: 'mv', 
          desc: mv.artistName || '' 
        }));
        if (isLoadMore) {
          searchDetail.value.mvs = [...(searchDetail.value.mvs || []), ...mappedNeteaseMvs];
        } else {
          searchDetail.value.mvs = mappedNeteaseMvs;
        }
        currentNeteaseHasMore = neteaseResult.mvs.length === ITEMS_PER_PAGE;
      } else if (neteaseResult && neteaseResult.songs) { 
        console.warn(`Search type was ${searchTypeToUse}, but received songs from Netease. Displaying as songs.`);
        const mappedNeteaseSongs = neteaseResult.songs.map((song: any): SongResult => {
           return { 
            id: song.id, name: song.name, ar: song.ar?.map((a: any) => ({ id: a.id, name: a.name })) || [], artists: song.artists?.map((a: any) => ({ id: a.id, name: a.name })) || [], al: { id: song.al?.id, name: song.al?.name, picUrl: song.al?.picUrl, pic_str: song.al?.pic_str, pic: song.al?.pic }, picUrl: song.al?.picUrl, dt: song.dt, source: 'netease'
           };
        });
        neteaseSongs = mappedNeteaseSongs;
        currentNeteaseHasMore = neteaseResult.songs.length === ITEMS_PER_PAGE;
      }
    } else if (neteaseRes.status === 'fulfilled' && !neteaseRes.value?.data) {
        console.warn('Netease API success but no data received.');
    }

    if (kwRes.status === 'fulfilled' && kwRes.value) {
      kwSongsResult = kwRes.value; // kwRes.value已经是SongResult[]
      currentKwHasMore = kwSongsResult.length === ITEMS_PER_PAGE;
    }

    // 合并歌曲：网易云单曲 + 酷我单曲 (如果搜索类型是单曲或者酷我只返回单曲)
    // 其他类型（专辑、歌单、MV）由网易云提供，已在上面分别处理并存入 searchDetail
    if (searchTypeToUse === SEARCH_TYPE.MUSIC) {
        combinedSongs = [...neteaseSongs, ...kwSongsResult];
        // 排序逻辑 (可以保持或调整)
        combinedSongs.sort((a, b) => { /* ... */ return 0; });
        if (isLoadMore) {
            searchDetail.value.songs = [...(searchDetail.value.songs || []), ...combinedSongs];
        } else {
            searchDetail.value.songs = combinedSongs;
        }
    } else {
        // 如果不是搜索单曲，酷我的结果（主要是歌曲）如何处理？
        // 选项1: 仍然合并到 searchDetail.value.songs (可能会让用户困惑，因为他们搜的是专辑等)
        // 选项2: 存到 searchDetail.value.kwSongs 并可能在UI上分开展示或提示
        // 选项3: 忽略酷我在此类搜索下的结果
        // 当前选择选项2，将酷我歌曲结果存入 kwSongs
        if (isLoadMore) {
            searchDetail.value.kwSongs = [...(searchDetail.value.kwSongs || []), ...kwSongsResult];
        } else {
            searchDetail.value.kwSongs = kwSongsResult;
        }
        // 如果网易云返回了单曲（例如作为fallback），它们已在上面被加入 neteaseSongs
        // 这里确保 neteaseSongs (如果因fallback产生) 也被加入到 songs 数组
        if (neteaseSongs.length > 0) {
           if (isLoadMore) {
               searchDetail.value.songs = [...(searchDetail.value.songs || []), ...neteaseSongs];
           } else {
               searchDetail.value.songs = neteaseSongs;
           }
        }
    }
    
    // 更新 hasMore 逻辑
    if (searchTypeToUse === SEARCH_TYPE.MUSIC) {
        hasMore.value = currentNeteaseHasMore || currentKwHasMore;
    } else if (searchTypeToUse === SEARCH_TYPE.ALBUM) {
        hasMore.value = currentNeteaseHasMore; // 酷我不提供精确专辑，只看网易云
    } else if (searchTypeToUse === SEARCH_TYPE.PLAYLIST) {
        hasMore.value = currentNeteaseHasMore; // 酷我不提供精确歌单
    } else if (searchTypeToUse === SEARCH_TYPE.MV) {
        hasMore.value = currentNeteaseHasMore; // 酷我不提供精确MV
    } else {
        hasMore.value = currentNeteaseHasMore || currentKwHasMore; // 默认情况
    }

  } catch (e) {
    console.error('搜索失败:', e);
    if (!isLoadMore) {
      // searchDetail.value = { songs: [], kwSongs: [] }; // 旧
      searchDetail.value = { songs: [], albums: [], playlists: [], mvs: [], kwSongs: [] }; // 新
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
    loadSearch(value);
  }
);

watch(
  () => searchType.value,
  () => {
    if (searchStore.searchValue) {
      loadSearch(searchStore.searchValue);
    }
  }
);
// 修改 store.state 的访问
if (searchStore.searchValue) {
  loadSearch(searchStore.searchValue);
}

// 修改 store.state 的设置
searchStore.searchValue = route.query.keyword as string;

const dateFormat = (time: any) => useDateFormat(time, 'YYYY.MM.DD').value;

// 添加滚动处理函数
const handleScroll = (e: any) => {
  const { scrollTop, scrollHeight, clientHeight } = e.target;
  // 距离底部100px时加载更多
  if (scrollTop + clientHeight >= scrollHeight - 100 && !isLoadingMore.value && hasMore.value) {
    loadSearch(currentKeyword.value, null, true);
  }
};

watch(
  () => route.query,
  (newQuery) => {
    if (newQuery.keyword && route.name === 'Search') {
      const typeFromQuery = newQuery.type ? Number(newQuery.type) : searchStore.searchType;
      loadSearch(newQuery.keyword as string, typeFromQuery, false);
    } else if (route.name === 'Search') {
      // searchDetail.value = { songs: [], kwSongs: [] }; // 旧
      searchDetail.value = { songs: [], albums: [], playlists: [], mvs: [], kwSongs: [] }; // 新
      hotKeyword.value = t('search.title.searchList');
    }
  },
  { immediate: true, deep: true }
);

const handlePlay = (item: any) => {
  // 添加到下一首
  playerStore.addToNextPlay(item);
};

// 点击搜索历史
const handleSearchHistory = (item: { keyword: string; type: number }) => {
  // 更新搜索类型
  searchStore.searchType = item.type;
  // 先更新搜索值到 store
  searchStore.searchValue = item.keyword;
  // 使用关键词和类型加载搜索
  loadSearch(item.keyword, item.type);
};

const handlePlayAll = () => {
  if (!searchDetail.value?.songs?.length) return;
  
  // 设置播放列表为搜索结果中的所有歌曲
  playerStore.setPlayList(searchDetail.value.songs);
  
  // 开始播放第一首歌
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
</style>
