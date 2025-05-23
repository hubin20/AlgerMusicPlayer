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
            <div class="search-album-grid">
              <div
                v-for="(albumItem, index) in searchDetail.albums"
                :key="albumItem.id || index"
                :class="setAnimationClass('animate__bounceInRight')" :style="getSearchListAnimation(index)"
              >
                <search-item :item="albumItem" shape="square" />
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
            <div class="search-mv-grid">
              <div
                v-for="(mvItem, index) in searchDetail.mvs"
                :key="mvItem.id || index"
                :class="setAnimationClass('animate__bounceInRight')" :style="getSearchListAnimation(index)"
              >
                <search-item :item="mvItem" shape="rectangle" />
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
  console.log('[Search] 组件挂载: 开始加载热搜和搜索历史');
  loadHotSearch();
  loadSearchHistory();
  
  // 组件挂载后，检查路由参数或store中是否有搜索关键词
  if (route.query.keyword && route.name === 'Search') {
    const typeFromQuery = route.query.type ? Number(route.query.type) : searchStore.searchType;
    console.log(`[Search] 从路由参数加载搜索: 关键词=${route.query.keyword}, 类型=${typeFromQuery}`);
    // 使用 nextTick 确保组件完全挂载后再执行搜索
    nextTick(() => {
      loadSearch(route.query.keyword as string, typeFromQuery, false);
    });
  } else if (searchStore.searchValue && route.name === 'Search') {
    console.log(`[Search] 从store加载搜索: 关键词=${searchStore.searchValue}, 类型=${searchStore.searchType}`);
    // 使用 nextTick 确保组件完全挂载后再执行搜索
    nextTick(() => {
      loadSearch(searchStore.searchValue, searchStore.searchType, false);
    });
  }
});

const hotKeyword = ref(route.query.keyword || t('search.title.searchList'));

const loadSearch = async (keywords: any, type: any = null, isLoadMore = false) => {
  if (!keywords) return;

  const searchTypeToUse = type !== null ? type : searchType.value;

  // 添加调试日志
  console.log(`[Search] 开始搜索: 关键词=${keywords}, 类型=${searchTypeToUse}, 是否加载更多=${isLoadMore}`);

  if (!isLoadMore) {
    hotKeyword.value = keywords;
    // 确保 searchDetail 被正确初始化为一个有效对象
    searchDetail.value = { 
      songs: [], 
      albums: [], 
      playlists: [], 
      mvs: [], 
      kwSongs: [] 
    };
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
    const [neteaseRes, kwRes] = await Promise.allSettled([neteasePromise, kwSongsPromise]);
    console.log(`[Search] 请求完成: 网易云状态=${neteaseRes.status}, 酷我状态=${kwRes.status}`);

    let neteaseSongs: SongResult[] = [];
    let neteaseAlbums: AlbumItem[] = [];
    let neteasePlaylists: PlaylistItem[] = [];
    let neteaseMvs: MvItem[] = [];
    let kwSongsResult: SongResult[] = [];

    let currentNeteaseHasMore = false;
    let currentKwHasMore = false;

    if (neteaseRes.status === 'fulfilled' && neteaseRes.value?.data?.result) {
      const neteaseResult = neteaseRes.value.data.result;
      console.log(`[Search] 网易云API返回数据:`, JSON.stringify(neteaseResult).substring(0, 100) + '...');
      
      // 根据 searchTypeToUse 处理不同类型的结果
      switch (searchTypeToUse) {
        case SEARCH_TYPE.MUSIC:
          if (neteaseResult.songs) {
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
            currentNeteaseHasMore = neteaseResult.songs.length === ITEMS_PER_PAGE;
          }
          break;
        case SEARCH_TYPE.ALBUM:
          if (neteaseResult.albums) {
            neteaseAlbums = neteaseResult.albums.map((album: any): AlbumItem => ({
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
            currentNeteaseHasMore = neteaseResult.albums.length === ITEMS_PER_PAGE;
          }
          break;
        case SEARCH_TYPE.PLAYLIST:
          if (neteaseResult.playlists) {
            neteasePlaylists = neteaseResult.playlists.map((playlist: any): PlaylistItem => ({
              id: playlist.id,
              name: playlist.name,
              coverImgUrl: playlist.coverImgUrl,
              picUrl: playlist.coverImgUrl || 'assets/default_playlist_cover.png', // For SearchItem
              trackCount: playlist.trackCount,
              playCount: playlist.playCount,
              creator: playlist.creator,
              description: playlist.description,
              bookCount: playlist.subscribedCount || playlist.bookCount,
              source: 'netease',
              type: 'playlist',
              desc: playlist.creator?.nickname || playlist.name || t('search.unknownPlaylistDesc')
            }));
            currentNeteaseHasMore = neteaseResult.playlists.length === ITEMS_PER_PAGE;
          }
          break;
        case SEARCH_TYPE.MV:
          // API 返回的是 mvs，不是 neteaseResult.mvs (根据截图，实际是 result.mvs)
          // 但 getSearch 封装后可能是 data.result.mvs
          const mvsData = neteaseRes.value.data.mvs || (neteaseRes.value.data.result && neteaseRes.value.data.result.mvs);
          if (mvsData) {
            neteaseMvs = mvsData.map((mv: any): MvItem => ({
              id: mv.id,
              name: mv.name,
              cover: mv.coverUrl || mv.imgurl || mv.cover,
              picUrl: mv.coverUrl || mv.imgurl || mv.cover || 'assets/default_mv_cover.png', // For SearchItem
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
            // MV 接口返回的 mvCount，用它来判断是否有更多
            currentNeteaseHasMore = mvsData.length < (neteaseRes.value.data.mvCount || 0) && mvsData.length === ITEMS_PER_PAGE;
          }
          break;
        default:
          // 处理其他未知类型或默认情况，可以尝试从 songs 中提取
          if (neteaseResult.songs) {
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
            currentNeteaseHasMore = neteaseResult.songs.length === ITEMS_PER_PAGE;
          }
          break;
      }
    } else if (neteaseRes.status === 'fulfilled' && !neteaseRes.value?.data?.result && !neteaseRes.value?.data?.mvs) {
      console.warn('[Search] 网易云API成功但没有返回结果数据:', neteaseRes.value);
    } else if (neteaseRes.status === 'rejected') {
      console.error('[Search] 网易云API请求失败:', neteaseRes.reason);
    }

    if (kwRes.status === 'fulfilled' && kwRes.value && Array.isArray(kwRes.value)) {
      kwSongsResult = kwRes.value;
      currentKwHasMore = kwSongsResult.length === ITEMS_PER_PAGE;
      console.log(`[Search] 酷我API返回歌曲数量: ${kwSongsResult.length}`);
    } else if (kwRes.status === 'rejected') {
      console.error('[Search] 酷我API请求失败:', kwRes.reason);
    }

    // 确保 searchDetail.value 始终是有效对象
    if (!searchDetail.value) {
      searchDetail.value = { songs: [], albums: [], playlists: [], mvs: [], kwSongs: [] };
    }

    if (isLoadMore) {
      if (searchDetail.value) { // Add null check
        if (searchTypeToUse === SEARCH_TYPE.MUSIC) {
          const combinedSongs = [...searchDetail.value.songs, ...neteaseSongs, ...kwSongsResult];
          combinedSongs.sort((a, b) => {
            const aIsNetease = a.source === 'netease';
            const bIsNetease = b.source === 'netease';
            if (aIsNetease && !bIsNetease) {
              return 1; // 网易云歌曲排在后面
            } else if (!aIsNetease && bIsNetease) {
              return -1; // 其他来源歌曲排在前面
            }
            return 0; // 同来源或都是其他来源，保持原始相对顺序（或后续可添加其他排序规则）
          });
          searchDetail.value.songs = combinedSongs;
        } else {
          searchDetail.value.albums = [...searchDetail.value.albums, ...neteaseAlbums];
          searchDetail.value.playlists = [...searchDetail.value.playlists, ...neteasePlaylists];
          searchDetail.value.mvs = [...searchDetail.value.mvs, ...neteaseMvs];
          searchDetail.value.kwSongs = [...searchDetail.value.kwSongs, ...kwSongsResult];
          if (neteaseSongs.length > 0) {
              searchDetail.value.songs = [...searchDetail.value.songs, ...neteaseSongs];
          }
        }
      }
    } else {
      // 确保 searchDetail.value 被正确初始化
      searchDetail.value = {
        songs: [], albums: [], playlists: [], mvs: [], kwSongs: [] // 初始化结构
      };
      
      if (searchTypeToUse === SEARCH_TYPE.MUSIC) {
        let combinedSongs = [...neteaseSongs, ...kwSongsResult];
        combinedSongs.sort((a, b) => {
          const aIsNetease = a.source === 'netease';
          const bIsNetease = b.source === 'netease';
          if (aIsNetease && !bIsNetease) {
            return 1; // 网易云歌曲排在后面
          } else if (!aIsNetease && bIsNetease) {
            return -1; // 其他来源歌曲排在前面
          }
          return 0; // 同来源或都是其他来源，保持原始相对顺序
        });
        searchDetail.value.songs = combinedSongs;
        searchDetail.value.kwSongs = []; // kwSongs are part of songs for MUSIC type
      } else {
        searchDetail.value.albums = neteaseAlbums;
        searchDetail.value.playlists = neteasePlaylists;
        searchDetail.value.mvs = neteaseMvs;
        searchDetail.value.kwSongs = kwSongsResult; // kwSongs are separate for other types if fetched
        searchDetail.value.songs = neteaseSongs; // Netease songs for other types if any
      }
      
      console.log(`[Search] 搜索结果统计: 歌曲=${searchDetail.value.songs.length}, 专辑=${searchDetail.value.albums.length}, 歌单=${searchDetail.value.playlists.length}, MV=${searchDetail.value.mvs.length}, 酷我歌曲=${searchDetail.value.kwSongs.length}`);
    }

    hasMore.value = currentNeteaseHasMore || currentKwHasMore;
    console.log(`[Search] 是否有更多结果: ${hasMore.value}`);

  } catch (e) {
    console.error('[Search] 搜索失败:', e);
    // 确保即使出错也有一个有效的 searchDetail 对象
    if (!searchDetail.value) {
      searchDetail.value = { songs: [], albums: [], playlists: [], mvs: [], kwSongs: [] };
    }
    hasMore.value = false;
  } finally {
    searchDetailLoading.value = false;
    isLoadingMore.value = false;
    console.log(`[Search] 搜索完成: loading=${searchDetailLoading.value}, loadingMore=${isLoadingMore.value}`);
  }
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
      // 使用 nextTick 确保在下一个 DOM 更新周期执行搜索
      nextTick(() => {
        loadSearch(value, searchStore.searchType, false);
      });
    }
  }
);

watch(
  () => searchType.value,
  (newType) => {
    console.log(`[Search] 搜索类型变化: ${newType}`);
    if (searchStore.searchValue) {
      // 使用 nextTick 确保在下一个 DOM 更新周期执行搜索
      nextTick(() => {
        loadSearch(searchStore.searchValue, newType, false);
      });
    }
  }
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

.search-album-grid {
  @apply grid gap-x-5 gap-y-5 px-4;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
}

.search-mv-grid {
  @apply grid gap-x-5 gap-y-5 px-4;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); // MV 通常宽一些
}
</style>
