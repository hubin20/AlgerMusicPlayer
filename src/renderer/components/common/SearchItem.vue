<template>
  <div
    class="search-item"
    :class="[
      shape,
      item.type,
      { 'recommend-item': shape === 'square' && item.type === 'playlist' }
    ]"
    @click="handleClick"
  >
    <div :class="{ 'recommend-item-img': shape === 'square' && item.type === 'playlist', 'search-item-img': !(shape === 'square' && item.type === 'playlist') }">
      <n-image
        class="w-full h-full"
        :src="getImgUrl(item.picUrl, item.type === 'mv' ? '320y180' : '200y200')"
        lazy
        preview-disabled
      />
      <div v-if="item.type === 'mv'" class="play">
        <i class="iconfont icon icon-play"></i>
      </div>
      <div v-if="shape === 'square' && item.type === 'playlist' && item.playCount" class="top">
        <div class="play-count">{{ formatNumber(item.playCount) }}</div>
        <i class="iconfont icon-videofill"></i>
      </div>
    </div>
    <div :class="{ 'recommend-item-title': shape === 'square' && item.type === 'playlist', 'search-item-info': !(shape === 'square' && item.type === 'playlist') }">
      <p :class="{ 'truncate': shape === 'square' && item.type === 'playlist', 'search-item-name': !(shape === 'square' && item.type === 'playlist') }">{{ item.name }}</p>
      <p v-if="!(shape === 'square' && item.type === 'playlist')" class="search-item-artist">{{ item.desc }}</p>
    </div>

    <div v-if="item.type === '专辑'" class="search-item-size">
      <i class="ri-music-2-line"></i>
      <span>{{ item.size }}</span>
    </div>

    <mv-player
      v-if="item.type === 'mv'"
      v-model:show="showPop"
      :current-mv="getCurrentMv()"
      no-list
    />
  </div>
</template>

<script setup lang="ts">
import { getAlbum, getListDetail } from '@/api/list';
import MvPlayer from '@/components/MvPlayer.vue';
import { usePlayerStore } from '@/store/modules/player';
import { IMvItem } from '@/type/mv';
import { getImgUrl, formatNumber } from '@/utils';
import { useRouter } from 'vue-router';
import { useMusicStore } from '@/store/modules/music';

const props = withDefaults(
  defineProps<{
    shape?: 'square' | 'rectangle';
    zIndex?: number;
    item: {
      picUrl: string;
      name: string;
      desc: string;
      type: string;
      [key: string]: any;
    };
  }>(),
  {
    shape: 'rectangle'
  }
);

const songList = ref<any[]>([]);

const showPop = ref(false);
const listInfo = ref<any>(null);

const playerStore = usePlayerStore();
const router = useRouter();
const musicStore = useMusicStore();

const getCurrentMv = () => {
  return {
    id: props.item.id,
    name: props.item.name
  } as unknown as IMvItem;
};

const handleClick = async () => {
  listInfo.value = null;
  if (props.item.type === '专辑') {
    const res = await getAlbum(props.item.id);
    songList.value = res.data.songs.map((song: any) => {
      song.al.picUrl = song.al.picUrl || props.item.picUrl;
      return song;
    });
    listInfo.value = {
      ...res.data.album,
      creator: {
        avatarUrl: res.data.album.artist.img1v1Url,
        nickname: `${res.data.album.artist.name} - ${res.data.album.company}`
      },
      description: res.data.album.description
    };

    console.log('[SearchItem] Album Info:', JSON.parse(JSON.stringify(listInfo.value)));
    console.log('[SearchItem] Song List:', JSON.parse(JSON.stringify(songList.value)));
    
    // 保存数据到store
    musicStore.setCurrentMusicList(
      songList.value, 
      props.item.name, 
      listInfo.value, 
      false
    );
    
    // 使用路由跳转
    router.push({
      name: 'musicList',
      params: { id: props.item.id },
      query: { type: 'album' }
    });
  } else if (props.item.type === 'playlist') {
    const res = await getListDetail(props.item.id);
    songList.value = res.data.playlist.tracks;
    listInfo.value = res.data.playlist;
    
    // 保存数据到store
    musicStore.setCurrentMusicList(
      songList.value, 
      props.item.name, 
      listInfo.value, 
      false
    );
    
    // 使用路由跳转
    router.push({
      name: 'musicList',
      params: { id: props.item.id },
      query: { type: 'playlist' }
    });
  } else if (props.item.type === 'mv') {
    handleShowMv();
  }
};

const handleShowMv = async () => {
  playerStore.handlePause();
  showPop.value = true;
};
</script>

<style scoped lang="scss">
.recommend-item {
  @apply flex flex-col cursor-pointer;

  &-img {
    @apply rounded-xl overflow-hidden relative w-full aspect-square mb-2;

    img {
      @apply absolute top-0 left-0 w-full h-full object-cover rounded-xl transition-transform duration-500;
    }
    
    .top {
      @apply absolute top-1 right-1 flex items-center px-2 py-1 rounded-full bg-black/30 text-white text-xs backdrop-blur-sm;
      .play-count {
        @apply mr-1;
      }
      .iconfont {
        @apply text-xs;
      }
    }
  }
  &-title {
    @apply mt-0 text-sm text-center text-gray-700 dark:text-gray-300 truncate w-full;
     p {
        @apply truncate font-normal;
     }
  }
}

.search-item {
  &:not(.playlist.square) {
     @apply rounded-lg p-0 flex items-center hover:bg-transparent transition cursor-pointer border-none;
  }

  &.square:not(.playlist) {
    @apply flex-col relative;

    .search-item-img {
      @apply w-full aspect-square mb-2 mr-0 rounded-lg overflow-hidden hover:shadow-xl transition-all duration-300 shadow-sm shadow-black/20 dark:shadow-white/20;
      img {
        @apply object-cover w-full h-full transition-transform duration-500;
      }
    }

    .search-item-info {
      @apply w-full text-left px-0;

      .search-item-name {
        @apply truncate mb-1 font-medium text-base text-gray-800 dark:text-gray-200;
      }

      .search-item-artist {
        @apply truncate text-sm text-gray-500 dark:text-gray-400;
      }
    }

    .search-item-size {
      @apply absolute top-2 right-2 text-xs text-white px-2 py-1 rounded-full bg-black/30 backdrop-blur-sm;
      i {
        @apply text-xs;
      }
    }
  }

  &.rectangle {
    @apply hover:bg-light-200 dark:hover:bg-dark-200 p-3;
    .search-item-img {
      @apply w-12 h-12 mr-4 rounded-lg overflow-hidden;
    }
  }

  .search-item-info:not(.recommend-item-title) {
    @apply flex-1 overflow-hidden;
    .search-item-name {
      &:not(.truncate) {
        @apply text-white text-sm text-center; 
      }
    }
    .search-item-artist {
      @apply text-gray-400 text-xs text-center;
    }
  }
}

.search-item.mv {
  &:hover {
    .play {
      @apply opacity-60;
    }
  }
  .search-item-img {
    width: 160px !important;
    height: 90px !important;
    @apply rounded-lg relative;
  }
  .play {
    @apply absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 transition-opacity;
    .icon {
      @apply text-white text-5xl;
    }
  }
}

.search-item-size {
  @apply flex items-center gap-2 text-gray-400;
}
</style>
