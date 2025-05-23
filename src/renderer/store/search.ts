import { defineStore } from 'pinia';
import type { SongResult, AlbumItem, Artist, PlaylistItem, MvItem } from '@renderer/types';

export const useSearchStore = defineStore('search', {
  state: () => ({
    searchValue: '',
    searchType: 1,
    songs: [] as SongResult[],
    albums: [] as AlbumItem[],
    artists: [] as Artist[],
    playlists: [] as PlaylistItem[],
    mvs: [] as MvItem[],
  }),
  actions: {
    setSearchValue(value: string) {
      this.searchValue = value;
    },
    setSearchType(type: number) {
      this.searchType = type;
    },
    setSongs(songs: SongResult[]) {
      this.songs = songs;
    },
    appendSongs(songs: SongResult[]) {
      this.songs = [...this.songs, ...songs];
    },
    setAlbums(albums: AlbumItem[]) {
      this.albums = albums;
    },
    appendAlbums(albums: AlbumItem[]) {
      this.albums = [...this.albums, ...albums];
    },
    setArtists(artists: Artist[]) {
      this.artists = artists;
    },
    appendArtists(artists: Artist[]) {
      this.artists = [...this.artists, ...artists];
    },
    setPlaylists(playlists: PlaylistItem[]) {
      this.playlists = playlists;
    },
    appendPlaylists(playlists: PlaylistItem[]) {
      this.playlists = [...this.playlists, ...playlists];
    },
    setMvs(mvs: MvItem[]) {
      this.mvs = mvs;
    },
    appendMvs(mvs: MvItem[]) {
      this.mvs = [...this.mvs, ...mvs];
    },
    clearAll() {
      this.songs = [];
      this.albums = [];
      this.artists = [];
      this.playlists = [];
      this.mvs = [];
    }
  }
}); 