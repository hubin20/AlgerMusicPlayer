export default {
  common: {
    confirm: 'Confirm',
    cancel: 'Cancel',
    close: 'Close',
    success: 'Success',
    fail: 'Fail',
    loading: 'Loading...',
    empty: 'No data',
    viewMore: 'View More',
    noMore: 'No more',
    selectAll: 'Select All',
    searchPlaceholder: 'Search songs, artists, albums, playlists, MVs',
    searchPlaceholderShort: 'Search...'
  },
  home: {
    title: 'Home',
    recommendPlaylist: 'Recommended Playlists',
    recommendSong: 'Daily Recommendation',
    newSong: 'New Songs',
    highQualityPlaylist: 'High-Quality Playlists',
    topPlaylist: 'Top Playlists'
  },
  search: {
    title: {
      hotSearch: 'Hot Searches',
      searchHistory: 'Search History',
      searchList: 'Search results for "{keyword}"',
      kwSongsFallback: 'Search results from Kuwo'
    },
    button: {
      search: 'Search',
      clear: 'Clear',
      playAll: 'Play All'
    },
    loading: {
      text: 'Searching...',
      more: 'Loading more...'
    },
    placeholder: 'Enter keywords',
    empty: 'No related content found',
    type: {
      single: 'Song',
      album: 'Album',
      singer: 'Artist',
      playlist: 'Playlist',
      user: 'User',
      mv: 'MV',
      lyric: 'Lyrics',
      radio: 'Radio',
      video: 'Video',
      all: 'All'
    },
    unknownAlbumDesc: 'Unknown Album Description',
    unknownPlaylistDesc: 'Unknown Playlist Description',
    unknownMvDesc: 'Unknown MV Description',
    noMore: 'No more search results'
  },
  playlist: {
    title: 'Playlist',
    playCount: 'Played: {count}',
    trackCount: 'Tracks: {count}',
    subscribedCount: 'Subscribed: {count}',
    creator: 'Creator',
    tags: 'Tags: ',
    description: 'Description: ',
    empty: 'No songs in this playlist yet'
  },
  artist: {
    title: 'Artist Details',
    hotSongs: 'Hot Songs',
    albums: 'Albums',
    mvs: 'MVs',
    description: 'Artist Description',
    simiArtist: 'Similar Artists'
  },
  album: {
    title: 'Album Details',
    artist: 'Artist: ',
    publishTime: 'Release Time: ',
    company: 'Company: ',
    description: 'Album Description: '
  },
  mv: {
    title: 'MV Details',
    playCount: 'Played: {count}',
    publishTime: 'Release Time: ',
    artists: 'Artists: ',
    description: 'MV Description: ',
    simiMv: 'Similar MVs'
  },
  player: {
    playlist: 'Playlist',
    history: 'History',
    lyrics: 'Lyrics',
    playing: 'Playing',
    paused: 'Paused',
    shuffle: 'Shuffle',
    repeatOne: 'Repeat One',
    repeatAll: 'Repeat All',
    volume: 'Volume',
    speed: 'Speed',
    quality: 'Quality',
    parse: 'Re-parse',
    parseSuccess: 'Re-parse successful',
    parseFailed: 'Re-parse failed',
    download: 'Download',
    downloading: 'Downloading...',
    downloadSuccess: 'Download successful',
    downloadFailed: 'Download failed',
    addToPlaylist: 'Add to Playlist',
    addToFavorite: 'Add to Favorites',
    removeFromFavorite: 'Remove from Favorites',
    clearPlaylist: 'Clear Playlist',
    urlExpired: 'Playback link has expired, trying to re-fetch'
  },
  setting: {
    title: 'Settings',
    general: 'General',
    appearance: 'Appearance',
    musicSource: 'Music Source',
    cache: 'Cache',
    about: 'About',
    language: 'Language',
    darkMode: 'Dark Mode',
    autoDarkMode: 'Follow System',
    themeColor: 'Theme Color',
    playQuality: 'Playback Quality',
    downloadQuality: 'Download Quality',
    lyricTranslation: 'Lyric Translation',
    lyricFontSize: 'Lyric Font Size',
    showDesktopLyric: 'Desktop Lyrics',
    desktopLyricStyle: 'Desktop Lyric Style',
    clearCache: 'Clear Cache',
    cacheSize: 'Cache Size: {size}',
    update: 'Check for Updates',
    version: 'Current Version: {version}',
    feedback: 'Feedback',
    github: 'Project Address'
  },
  favorite: {
    title: 'My Favorites',
    count: '{count} songs in total',
    emptyTip: 'You haven\'t favorited any songs yet',
    getFailed: 'Failed to get favorite list',
    batchDownload: 'Batch Operation',
    download: 'Download Selected ({count})',
    downloading: 'Submitting download tasks...',
    downloadSuccess: 'All download tasks submitted',
    downloadFailed: 'Some songs failed to download',
    selectSongsFirst: 'Please select songs first'
  },
  history: {
    title: 'Playback History',
    count: '{count} songs in total',
    clear: 'Clear History',
    emptyTip: 'You haven\'t played any songs yet'
  },
  local: {
    title: 'Local Music',
    scan: 'Scan Local Songs',
    scanning: 'Scanning...',
    scanSuccess: 'Scan complete, found {count} songs',
    scanEmpty: 'No songs found, please check scan directory or file type settings',
    folder: 'Music Folder',
    addFolder: 'Add Folder',
    removeFolder: 'Remove Folder',
    fileType: 'File Types',
    emptyTip: 'No local music, go scan and add some'
  },
  download: {
    title: 'Download Management',
    downloading: 'Downloading',
    downloaded: 'Downloaded',
    emptyTip: 'No download tasks'
  }
}; 