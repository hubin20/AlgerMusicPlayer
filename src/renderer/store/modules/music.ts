import { defineStore } from 'pinia';

interface MusicState {
  currentMusicList: any[] | null;
  currentMusicListName: string;
  currentListInfo: any | null;
  canRemoveSong: boolean;
  collectedPlaylists: any[];
}

export const useMusicStore = defineStore('music', {
  state: (): MusicState => ({
    currentMusicList: null,
    currentMusicListName: '',
    currentListInfo: null,
    canRemoveSong: false,
    collectedPlaylists: []
  }),

  actions: {
    // 设置当前音乐列表
    setCurrentMusicList(list: any[], name: string, listInfo: any = null, canRemove = false) {
      this.currentMusicList = list;
      this.currentMusicListName = name;
      this.currentListInfo = listInfo;
      this.canRemoveSong = canRemove;
    },

    // 清除当前音乐列表
    clearCurrentMusicList() {
      this.currentMusicList = null;
      this.currentMusicListName = '';
      this.currentListInfo = null;
      this.canRemoveSong = false;
    },

    // 从列表中移除一首歌曲
    removeSongFromList(id: number) {
      if (!this.currentMusicList) return;

      const index = this.currentMusicList.findIndex((song) => song.id === id);
      if (index !== -1) {
        this.currentMusicList.splice(index, 1);
      }
    },

    // 新增：添加收藏歌单
    addCollectedPlaylist(playlist: any) {
      if (!this.collectedPlaylists.find(p => p.id === playlist.id)) {
        this.collectedPlaylists.push(playlist);
        // TODO: 可以考虑持久化存储 collectedPlaylists 到 localStorage
      }
    },

    // 新增：移除收藏歌单
    removeCollectedPlaylist(playlistId: number) {
      this.collectedPlaylists = this.collectedPlaylists.filter(p => p.id !== playlistId);
      // TODO: 可以考虑持久化存储 collectedPlaylists 到 localStorage
    }
  }
}); 