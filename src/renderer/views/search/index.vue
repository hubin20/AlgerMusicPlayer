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
        <div v-if="searchType === SEARCH_TYPE.MUSIC && searchStore.songs.length" class="title-play-all">
          <div class="play-all-btn" @click="handlePlayAll">
            <i class="ri-play-circle-fill"></i>
            <span>{{ t('search.button.playAll') }}</span>
          </div>
        </div>
      </div>
      <div v-loading="searchDetailLoading" class="search-list-box">
        <template v-if="searchStore.searchValue">
          <!-- 单曲搜索结果 -->
          <template v-if="searchType === SEARCH_TYPE.MUSIC && searchStore.songs.length">
            <div
              v-for="(item, index) in searchStore.songs"
              :key="item.id || index" 
              :class="setAnimationClass('animate__bounceInRight')" :style="getSearchListAnimation(index)"
            >
              <song-item :item="item" @play="handlePlay" :is-next="true" />
            </div>
          </template>
          
          <!-- 专辑搜索结果 -->
          <template v-else-if="searchType === SEARCH_TYPE.ALBUM && searchStore.albums.length">
            <div class="search-album-grid">
              <div
                v-for="(albumItem, index) in searchStore.albums"
                :key="albumItem.id || index"
                :class="setAnimationClass('animate__bounceInRight')" :style="getSearchListAnimation(index)"
              >
                <search-item :item="albumItem" shape="square" />
              </div>
            </div>
          </template>
          
          <!-- 歌手搜索结果 -->
          <template v-else-if="searchType === SEARCH_TYPE.ARTIST && searchStore.artists.length">
            <div class="search-artist-grid">
              <div
                v-for="(artistItem, index) in searchStore.artists"
                :key="artistItem.id || index"
                :class="setAnimationClass('animate__bounceInRight')" :style="getSearchListAnimation(index)"
              >
                <search-item :item="artistItem" shape="circle" />
              </div>
            </div>
          </template>
          
          <!-- 歌单搜索结果 -->
          <template v-else-if="searchType === SEARCH_TYPE.PLAYLIST && searchStore.playlists.length">
            <div class="search-playlist-grid">
              <div
                v-for="(playlistItem, index) in searchStore.playlists"
                :key="playlistItem.id || index"
                :class="setAnimationClass('animate__bounceInRight')" :style="getSearchListAnimation(index)"
              >
                <search-item :item="playlistItem" shape="square" />
              </div>
            </div>
          </template>
          
          <!-- MV搜索结果 -->
          <template v-else-if="searchType === SEARCH_TYPE.MV && searchStore.mvs.length">
            <div class="search-mv-grid">
              <div
                v-for="(mvItem, index) in searchStore.mvs"
                :key="mvItem.id || index"
                :class="setAnimationClass('animate__bounceInRight')" :style="getSearchListAnimation(index)"
              >
                <search-item :item="mvItem" shape="rectangle" />
              </div>
            </div>
          </template>
          
          <!-- 无搜索结果 -->
          <template v-else-if="!isLoading.value && !isFirstLoad.value">
            <div class="no-result">
              <i class="ri-search-line"></i>
              <p>{{ t('search.noResult') }}</p>
            </div>
          </template>

          <!-- 加载状态 -->
          <div v-if="isLoadingMore.value" class="loading-more">
            <n-spin size="small" />
            <span class="ml-2">{{ t('search.loading.more') }}</span>
          </div>
          <div v-if="!hasMore.value && !isLoadingMore.value && !isFirstLoad.value" class="no-more">{{ t('search.noMore') }}</div>

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
import { computed, onMounted, ref, watch, nextTick } from 'vue';
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

// 添加缺失的变量声明
let keywords = '';
let searchTypeToUse = SEARCH_TYPE.MUSIC;

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
  // 从本地存储获取搜索历史
  const history = localStorage.getItem('searchHistory');
  if (history) {
    try {
      const historyArray = JSON.parse(history);
      if (Array.isArray(historyArray)) {
        // 检查是否是旧格式（纯字符串数组）并转换
        if (historyArray.length > 0 && typeof historyArray[0] === 'string') {
          const convertedArray = historyArray.map(item => ({
            keyword: item,
            type: SEARCH_TYPE.MUSIC
          }));
          searchHistory.value = convertedArray;
          // 保存转换后的格式
          localStorage.setItem('searchHistory', JSON.stringify(convertedArray));
        } else {
          searchHistory.value = historyArray;
        }
        console.log('[Search] 加载搜索历史:', historyArray);
      }
    } catch (e) {
      console.error('[Search] 解析搜索历史失败:', e);
    }
  }
};

const clearSearchHistory = () => {
  localStorage.removeItem('searchHistory');
  searchHistory.value = [];
  console.log('[Search] 清空搜索历史');
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

// 添加防抖函数
let searchDebounceTimer: number | null = null;
const debounceSearch = (fn: Function, delay: number = 300) => {
  if (searchDebounceTimer !== null) {
    clearTimeout(searchDebounceTimer);
  }
  searchDebounceTimer = window.setTimeout(() => {
    fn();
    searchDebounceTimer = null;
  }, delay) as unknown as number;
};

onMounted(() => {
  console.log('[Search] 组件挂载: 开始加载热搜和搜索历史');
  loadHotSearch();
  loadSearchHistory();
  
  // 组件挂载后，检查路由参数或store中是否有搜索关键词
  if (route.query.keyword && route.name === 'Search') {
    const typeFromQuery = route.query.type ? Number(route.query.type) : searchStore.searchType;
    console.log(`[Search] 从路由参数加载搜索: 关键词=${route.query.keyword}, 类型=${typeFromQuery}`);
    // 直接执行搜索，不使用防抖
    nextTick(() => {
      loadSearch(route.query.keyword as string, typeFromQuery, false);
    });
  } else if (searchStore.searchValue && route.name === 'Search') {
    console.log(`[Search] 从store加载搜索: 关键词=${searchStore.searchValue}, 类型=${searchStore.searchType}`);
    // 直接执行搜索，不使用防抖
    nextTick(() => {
      loadSearch(searchStore.searchValue, searchStore.searchType, false);
    });
  }
});

const hotKeyword = ref(route.query.keyword || t('search.title.searchList'));

const loadSearch = async (value: string, type: number, needAddHistory = true) => {
  if (!value.trim()) {
    console.log('[Search] 搜索值为空，不执行搜索');
    return;
  }

  keywords = value;
  searchTypeToUse = type;
  isLoading.value = true;
  isFirstLoad.value = true;
  page.value = 0;
  
  // 清空之前的搜索结果
  searchStore.setSearchValue(value);
  searchStore.setSearchType(type);
  searchStore.setSongs([]);
  searchStore.setAlbums([]);
  searchStore.setArtists([]);
  searchStore.setPlaylists([]);
  searchStore.setMvs([]);
  
  console.log(`[Search] 新的搜索: 关键词=${value}, 类型=${type}, 是否加入历史=${needAddHistory}`);
  
  if (needAddHistory) {
    addSearchHistory(value);
  }
  
  // 执行加载更多操作，这将触发实际的搜索请求
  await nextTick();
  await loadMore();
  
  isLoading.value = false;
  isFirstLoad.value = false;
};

watch(
  () => route.query,
  (newQuery) => {
    console.log('[Search] 路由参数变化:', newQuery);
    if (newQuery.keyword && route.name === 'Search') {
      const typeFromQuery = newQuery.type ? Number(newQuery.type) : searchStore.searchType;
      console.log(`[Search] 路由参数变化触发搜索: 关键词=${newQuery.keyword}, 类型=${typeFromQuery}`);
      searchStore.searchType = typeFromQuery;
      searchStore.searchValue = newQuery.keyword as string;
      // 不需要在这里调用 loadSearch，因为 watch searchStore.searchValue 会触发搜索
    } else if (route.name === 'Search' && !newQuery.keyword) {
      console.log('[Search] 路由参数变化: 无关键词，清空搜索结果');
      searchDetail.value = { songs: [], albums: [], playlists: [], mvs: [], kwSongs: [] };
      hotKeyword.value = t('search.title.searchList');
    }
  },
  { immediate: true, deep: true }
);

watch(
  () => searchStore.searchValue,
  (value) => {
    console.log(`[Search] 搜索值变化: ${value}`);
    if (value) {
      // 使用防抖函数执行搜索
      debounceSearch(() => {
        loadSearch(value, searchStore.searchType, false);
      }, 300);
    }
  }
);

watch(
  () => searchType.value,
  (newType) => {
    console.log(`[Search] 搜索类型变化: ${newType}`);
    if (searchStore.searchValue) {
      // 使用防抖函数执行搜索
      debounceSearch(() => {
        loadSearch(searchStore.searchValue, newType, false);
      }, 300);
    }
  }
);

const handleScroll = (e: any) => {
  const { scrollTop, scrollHeight, clientHeight } = e.target;
  if (scrollTop + clientHeight >= scrollHeight - 100 && !isLoadingMore.value && hasMore.value) {
    console.log('[Search] 滚动触发加载更多');
    loadMore();
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
  if (!searchStore.songs.length) return;
  playerStore.setPlayList(searchStore.songs);
  if (searchStore.songs[0]) {
    playerStore.setPlay(searchStore.songs[0]);
  }
};

const isLoading = ref(false);
const isFirstLoad = ref(true);
const hasMore = ref(true);
const isLoadingMore = ref(false);

// 添加加载更多函数
const loadMore = async () => {
  if (isLoadingMore.value || !hasMore.value) {
    console.log('[Search] 已在加载或没有更多结果，跳过加载');
    return;
  }

  if (!keywords) {
    console.log('[Search] 没有搜索关键词，跳过加载');
    return;
  }

  isLoadingMore.value = true;
  console.log('[Search] 开始加载更多结果');

  try {
    page.value++;
    console.log(`[Search] 页码: ${page.value}, 每页数量: ${ITEMS_PER_PAGE}`);

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

    console.log(`[Search] 发送请求: 网易云和酷我API`);
    
    const [neteaseRes, kwRes] = await Promise.allSettled([
      neteasePromise,
      kwSongsPromise
    ]);
    
    console.log(`[Search] 请求完成: 网易云状态=${neteaseRes.status}, 酷我状态=${kwRes.status}`);

    // 处理网易云搜索结果
    if (neteaseRes.status === 'fulfilled' && neteaseRes.value?.data?.result) {
      const result = neteaseRes.value.data.result;
      
      // 根据搜索类型处理不同的结果
      switch (searchTypeToUse) {
        case SEARCH_TYPE.MUSIC:
          if (result.songs && result.songs.length > 0) {
            const songs = formatSongs(result.songs);
            searchStore.appendSongs(songs);
            hasMore.value = result.songs.length === ITEMS_PER_PAGE;
          } else {
            hasMore.value = false;
          }
          break;
        case SEARCH_TYPE.ALBUM:
          if (result.albums && result.albums.length > 0) {
            const albums = formatAlbums(result.albums);
            searchStore.appendAlbums(albums);
            hasMore.value = result.albums.length === ITEMS_PER_PAGE;
          } else {
            hasMore.value = false;
          }
          break;
        case SEARCH_TYPE.ARTIST:
          if (result.artists && result.artists.length > 0) {
            const artists = formatArtists(result.artists);
            searchStore.appendArtists(artists);
            hasMore.value = result.artists.length === ITEMS_PER_PAGE;
          } else {
            hasMore.value = false;
          }
          break;
        case SEARCH_TYPE.PLAYLIST:
          if (result.playlists && result.playlists.length > 0) {
            const playlists = formatPlaylists(result.playlists);
            searchStore.appendPlaylists(playlists);
            hasMore.value = result.playlists.length === ITEMS_PER_PAGE;
          } else {
            hasMore.value = false;
          }
          break;
        case SEARCH_TYPE.MV:
          if (result.mvs && result.mvs.length > 0) {
            const mvs = formatMvs(result.mvs);
            searchStore.appendMvs(mvs);
            hasMore.value = result.mvs.length === ITEMS_PER_PAGE;
          } else {
            hasMore.value = false;
          }
          break;
        default:
          console.warn(`[Search] 未知的搜索类型: ${searchTypeToUse}`);
          hasMore.value = false;
      }
    } else if (neteaseRes.status === 'rejected') {
      console.error('[Search] 网易云API请求失败:', neteaseRes.reason);
      hasMore.value = false;
    }

    // 处理酷我搜索结果（仅限歌曲类型）
    if (searchTypeToUse === SEARCH_TYPE.MUSIC && kwRes.status === 'fulfilled' && Array.isArray(kwRes.value)) {
      if (kwRes.value.length > 0) {
        searchStore.appendSongs(kwRes.value);
        // 如果网易云没有更多但酷我有，则继续允许加载更多
        if (!hasMore.value) {
          hasMore.value = kwRes.value.length === ITEMS_PER_PAGE;
        }
      }
    } else if (kwRes.status === 'rejected' && searchTypeToUse === SEARCH_TYPE.MUSIC) {
      console.error('[Search] 酷我API请求失败:', kwRes.reason);
    }

    console.log(`[Search] 加载完成: 是否有更多=${hasMore.value}`);
  } catch (error) {
    console.error('[Search] 加载更多时发生错误:', error);
    hasMore.value = false;
  } finally {
    isLoadingMore.value = false;
  }
};

// 添加格式化函数
const formatSongs = (songs: any[]): SongResult[] => {
  return songs.map((song: any): SongResult => {
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
      ar: artists,
      artists: artists,
      al: {
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
      album: { 
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
      picUrl: albumData.picUrl || '',
      dt: song.dt || 0,
      duration: song.dt || 0,
      source: 'netease',
      count: 0,
    };
  });
};

const formatAlbums = (albums: any[]): AlbumItem[] => {
  return albums.map((album: any): AlbumItem => ({
    id: album.id,
    name: album.name,
    picUrl: album.picUrl || album.blurPicUrl || 'assets/default_album_cover.png',
    blurPicUrl: album.blurPicUrl,
    artist: album.artist,
    artists: album.artists,
    artistName: album.artist?.name,
    publishTime: album.publishTime,
    size: album.size,
    company: album.company,
    description: album.description,
    tags: album.tags,
    idStr: album.idStr,
    status: album.status,
    copyrightId: album.copyrightId,
    commentThreadId: album.commentThreadId,
    onSale: album.onSale,
    isSub: album.isSub,
    source: 'netease',
    type: '专辑',
    desc: album.artist?.name || album.name || t('search.unknownAlbumDesc')
  }));
};

const formatArtists = (artists: any[]): Artist[] => {
  return artists.map((artist: any): Artist => ({
    id: artist.id || 0,
    name: artist.name || '未知歌手',
    picId: artist.picId || 0,
    img1v1Id: artist.img1v1Id || 0,
    briefDesc: artist.briefDesc || '',
    picUrl: artist.picUrl || artist.img1v1Url || '',
    img1v1Url: artist.img1v1Url || '',
    albumSize: artist.albumSize || 0,
    alias: artist.alias || [],
    trans: artist.trans || '',
    musicSize: artist.musicSize || 0,
    topicPerson: artist.topicPerson || 0
  }));
};

const formatPlaylists = (playlists: any[]): PlaylistItem[] => {
  return playlists.map((playlist: any): PlaylistItem => ({
    id: playlist.id,
    name: playlist.name,
    coverImgUrl: playlist.coverImgUrl,
    picUrl: playlist.coverImgUrl || 'assets/default_playlist_cover.png',
    trackCount: playlist.trackCount,
    playCount: playlist.playCount,
    creator: playlist.creator,
    description: playlist.description,
    bookCount: playlist.subscribedCount || playlist.bookCount,
    source: 'netease',
    type: 'playlist',
    desc: playlist.creator?.nickname || playlist.name || t('search.unknownPlaylistDesc')
  }));
};

const formatMvs = (mvs: any[]): MvItem[] => {
  return mvs.map((mv: any): MvItem => ({
    id: mv.id,
    name: mv.name,
    cover: mv.coverUrl || mv.imgurl || mv.cover,
    picUrl: mv.coverUrl || mv.imgurl || mv.cover || 'assets/default_mv_cover.png',
    playCount: mv.playCount,
    briefDesc: mv.briefDesc,
    desc: mv.desc || mv.briefDesc || mv.artistName || mv.name || t('search.unknownMvDesc'),
    artistName: mv.artistName,
    artistId: mv.artistId,
    artists: mv.artists,
    duration: mv.duration,
    mark: mv.mark,
    source: 'netease',
    type: 'mv'
  }));
};

// 搜索历史相关函数
const addSearchHistory = (keyword: string) => {
  if (!keyword.trim()) return;
  
  // 从本地存储获取搜索历史
  let historyStorage = localStorage.getItem('searchHistory');
  let historyArray: {keyword: string; type: number}[] = [];
  
  if (historyStorage) {
    try {
      historyArray = JSON.parse(historyStorage);
      // 确保historyArray是数组
      if (!Array.isArray(historyArray)) {
        historyArray = [];
      }
    } catch (e) {
      console.error('[Search] 解析搜索历史失败:', e);
      historyArray = [];
    }
  }
  
  // 如果关键词已存在，先移除旧的
  const index = historyArray.findIndex(item => item.keyword === keyword);
  if (index > -1) {
    historyArray.splice(index, 1);
  }
  
  // 将新关键词添加到数组开头
  historyArray.unshift({ keyword, type: searchTypeToUse });
  
  // 限制历史记录数量
  if (historyArray.length > 10) {
    historyArray = historyArray.slice(0, 10);
  }
  
  // 保存到本地存储
  localStorage.setItem('searchHistory', JSON.stringify(historyArray));
  
  // 更新搜索历史显示
  searchHistory.value = historyArray;
  console.log('[Search] 添加搜索历史:', keyword);
};

const removeSearchHistoryItem = (keyword: string) => {
  let history = localStorage.getItem('searchHistory');
  if (history) {
    try {
      let historyArray = JSON.parse(history);
      if (Array.isArray(historyArray)) {
        historyArray = historyArray.filter(item => {
          // 兼容新旧格式
          if (typeof item === 'string') {
            return item !== keyword;
          } else {
            return item.keyword !== keyword;
          }
        });
        localStorage.setItem('searchHistory', JSON.stringify(historyArray));
        searchHistory.value = historyArray;
        console.log('[Search] 移除搜索历史项:', keyword);
      }
    } catch (e) {
      console.error('[Search] 解析搜索历史失败:', e);
    }
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

.search-album-grid {
  @apply grid gap-x-5 gap-y-5 px-4;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
}

.search-mv-grid {
  @apply grid gap-x-5 gap-y-5 px-4;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); // MV 通常宽一些
}

.search-artist-grid {
  @apply grid gap-x-5 gap-y-5 px-4;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
}

.no-result {
  @apply flex flex-col items-center justify-center py-16;
  @apply text-gray-500 dark:text-gray-400;
  
  i {
    @apply text-6xl mb-4;
  }
  
  p {
    @apply text-lg;
  }
}
</style>
