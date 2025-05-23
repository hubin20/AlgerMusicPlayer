export default {
  common: {
    confirm: '确认',
    cancel: '取消',
    close: '关闭',
    success: '成功',
    fail: '失败',
    loading: '加载中...',
    empty: '暂无数据',
    viewMore: '查看更多',
    noMore: '没有更多了',
    selectAll: '全选',
    searchPlaceholder: '搜索歌曲、歌手、专辑、歌单、MV',
    searchPlaceholderShort: '搜索...'
  },
  home: {
    title: '首页',
    recommendPlaylist: '推荐歌单',
    recommendSong: '每日推荐',
    newSong: '新歌速递',
    highQualityPlaylist: '精品歌单',
    topPlaylist: '排行榜'
  },
  search: {
    title: {
      hotSearch: '热门搜索',
      searchHistory: '搜索历史',
      searchList: '“{keyword}”的搜索结果',
      kwSongsFallback: '来自酷我的搜索结果'
    },
    button: {
      search: '搜索',
      clear: '清空',
      playAll: '播放全部'
    },
    loading: {
      text: '正在搜索中...',
      more: '加载中...'
    },
    placeholder: '请输入关键词',
    empty: '未找到相关内容',
    type: {
      single: '单曲',
      album: '专辑',
      singer: '歌手',
      playlist: '歌单',
      user: '用户',
      mv: 'MV',
      lyric: '歌词',
      radio: '电台',
      video: '视频',
      all: '综合'
    },
    unknownAlbumDesc: '未知专辑描述',
    unknownPlaylistDesc: '未知歌单描述',
    unknownMvDesc: '未知MV描述',
    noMore: '没有更多搜索结果了'
  },
  playlist: {
    title: '歌单',
    playCount: '播放量：{count}',
    trackCount: '歌曲数：{count}',
    subscribedCount: '收藏数：{count}',
    creator: '创建者',
    tags: '标签：',
    description: '简介：',
    empty: '歌单内暂无歌曲'
  },
  artist: {
    title: '歌手详情',
    hotSongs: '热门歌曲',
    albums: '专辑',
    mvs: 'MV',
    description: '歌手简介',
    simiArtist: '相似歌手'
  },
  album: {
    title: '专辑详情',
    artist: '歌手：',
    publishTime: '发行时间：',
    company: '发行公司：',
    description: '专辑简介：'
  },
  mv: {
    title: 'MV详情',
    playCount: '播放量：{count}',
    publishTime: '发布时间：',
    artists: '歌手：',
    description: 'MV简介：',
    simiMv: '相似MV'
  },
  player: {
    playlist: '播放列表',
    history: '播放历史',
    lyrics: '歌词',
    playing: '正在播放',
    paused: '已暂停',
    shuffle: '随机播放',
    repeatOne: '单曲循环',
    repeatAll: '列表循环',
    volume: '音量',
    speed: '倍速',
    quality: '音质',
    parse: '重新解析',
    parseSuccess: '重新解析成功',
    parseFailed: '重新解析失败',
    download: '下载',
    downloading: '下载中...',
    downloadSuccess: '下载成功',
    downloadFailed: '下载失败',
    addToPlaylist: '添加到播放列表',
    addToFavorite: '添加到收藏',
    removeFromFavorite: '从收藏中移除',
    clearPlaylist: '清空播放列表',
    urlExpired: '播放链接已失效，正在尝试重新获取'
  },
  setting: {
    title: '设置',
    general: '通用设置',
    appearance: '外观设置',
    musicSource: '音源选择',
    cache: '缓存设置',
    about: '关于',
    language: '语言',
    darkMode: '深色模式',
    autoDarkMode: '跟随系统',
    themeColor: '主题色',
    playQuality: '播放音质',
    downloadQuality: '下载音质',
    lyricTranslation: '歌词翻译',
    lyricFontSize: '歌词字号',
    showDesktopLyric: '桌面歌词',
    desktopLyricStyle: '桌面歌词样式',
    clearCache: '清理缓存',
    cacheSize: '缓存大小：{size}',
    update: '检查更新',
    version: '当前版本：{version}',
    feedback: '意见反馈',
    github: '项目地址'
  },
  favorite: {
    title: '我的收藏',
    count: '共 {count} 首',
    emptyTip: '你还没有收藏任何歌曲哦',
    getFailed: '获取收藏列表失败',
    batchDownload: '批量操作',
    download: '下载已选({count})',
    downloading: '正在提交下载任务...',
    downloadSuccess: '已提交所有下载任务',
    downloadFailed: '部分歌曲下载失败',
    selectSongsFirst: '请先选择歌曲'
  },
  history: {
    title: '播放历史',
    count: '共 {count} 首',
    clear: '清空历史',
    emptyTip: '你还没有播放过任何歌曲哦'
  },
  local: {
    title: '本地音乐',
    scan: '扫描本地歌曲',
    scanning: '正在扫描...',
    scanSuccess: '扫描完成，共发现 {count} 首歌曲',
    scanEmpty: '未扫描到歌曲，请检查扫描目录或文件类型设置',
    folder: '歌曲目录',
    addFolder: '添加目录',
    removeFolder: '移除目录',
    fileType: '文件类型',
    emptyTip: '本地没有音乐哦，快去扫描添加吧'
  },
  download: {
    title: '下载管理',
    downloading: '正在下载',
    downloaded: '已下载',
    emptyTip: '暂无下载任务'
  }
}; 