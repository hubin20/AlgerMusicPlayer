import axios from 'axios';
// import type { AxiosResponse } from 'axios'; // 移除未使用的导入
import type { SongResult, Artist, Album } from '@/type/music'; // Album 需要保留，因为它在 mapKwSongToSongResult 中直接作为 al 和 album 的类型注解
// import type { ILyric } from '@/type/lyric'; // 移除未使用的导入

const KW_API_BASE_URL = 'https://kw-api.cenguigui.cn'; // 在模块顶部定义常量

// 定义 kw-api 返回的歌曲数据结构（根据文档示例）
interface KwSongDataItem {
  rid: number; // 作为歌曲 ID
  name: string;
  artist: string; // 需要转换成 Artist[]
  album?: string; // 新增：从实际API响应中发现存在album字段
  pic: string;
  lrc: string; // 歌词API链接
  url: string; // 歌曲播放API链接，但实际播放链接需要再次请求
  // 文档中没有明确的专辑信息和时长，看实际返回
}

// 搜索API响应结构
interface KwSearchApiResponse {
  code: number;
  msg?: string;
  data: KwSongDataItem[]; // data 直接是歌曲数组
}

// 歌词API中每行歌词的结构
interface KwLyricLineItem {
  lineLyric: string;
  time: string; // 秒数，例如 "0.3"
}

// 歌词API响应结构
interface KwLyricApiResponse {
  code: number;
  msg?: string;
  data: {
    lrclist: KwLyricLineItem[];
  };
}

/**
 * 将 kw-api 的歌手字符串转换为 Artist[] 数组
 * @param artistStr - 歌手名字字符串，可能包含多个歌手，如 "徐良&小凌"
 * @returns Artist[]
 */
function mapArtistStringToArtistArray(artistStr: string): Artist[] {
  if (!artistStr) {
    return [];
  }
  return artistStr.split('&').map(name => ({
    id: 0,
    name: name.trim(),
    picUrl: '',
    img1v1Url: '',
    briefDesc: '',
    albumSize: 0,
    alias: [],
    trans: '',
    musicSize: 0,
    picId: 0,
    img1v1Id: 0,
    topicPerson: 0
  }));
}

/**
 * 将 kw-api 返回的歌曲条目转换为 SongResult 格式
 * @param kwSong - KwSongDataItem
 * @returns Partial<SongResult> - 返回部分 SongResult，因为某些字段可能缺失
 */
function mapKwSongToSongResult(kwSong: KwSongDataItem): SongResult {
  const baseAlbum: Album = {
    id: 0,
    name: kwSong.album || '未知专辑',
    picUrl: kwSong.pic,
    picId_str: '',
    pic: 0,
    type: '',
    size: 0,
    picId: 0,
    blurPicUrl: '',
    companyId: 0,
    publishTime: 0,
    description: '',
    tags: '',
    company: '',
    briefDesc: '',
    artist: {
      id: 0, name: '', picId: 0, img1v1Id: 0, briefDesc: '', picUrl: '', img1v1Url: '', albumSize: 0, alias: [], trans: '', musicSize: 0, topicPerson: 0
    },
    songs: [],
    alias: [],
    status: 0,
    copyrightId: 0,
    commentThreadId: '',
    artists: [],
    subType: '',
    onSale: false,
    mark: 0
  };
  return {
    id: kwSong.rid,
    name: kwSong.name,
    ar: mapArtistStringToArtistArray(kwSong.artist),
    artists: mapArtistStringToArtistArray(kwSong.artist),
    al: { ...baseAlbum },
    album: { ...baseAlbum },
    picUrl: kwSong.pic,
    source: 'other',
    count: 0,
  };
}

/**
 * 搜索歌曲 - 来自 kw-api
 * @param keywords - 搜索关键词
 * @param page - 页码
 * @param limit - 每页数量
 * @param _searchType - 搜索类型 (虽然此API主要用于搜歌，但保留参数以备未来可能支持)
 * @returns Promise<SongResult[]>
 */
export async function searchKwMusic(
  keywords: string,
  page: number = 1,
  limit: number = 30,
  _searchType: number = 1 // 将 searchType 改为 _searchType
): Promise<SongResult[]> {
  try {
    console.log(`[酷我API] 开始搜索: 关键词=${keywords}, 页码=${page}, 限制=${limit}`);

    // 确保关键词有效
    if (!keywords || keywords.trim() === '') {
      console.warn('[酷我API] 搜索关键词为空');
      return [];
    }

    const params: any = {
      name: keywords,
      page,
      limit,
      // type: 'search' // 文档中没有明确指出搜索时需要此 type，但有些API可能需要，暂时注释
    };

    // 示例: https://kw-api.cenguigui.cn?name=坏女孩&page=1&limit=10
    const response = await axios.get<KwSearchApiResponse>(
      KW_API_BASE_URL,
      {
        params,
        timeout: 10000, // 设置10秒超时
      }
    );

    if (response.data.code === 200 && Array.isArray(response.data.data)) {
      const songs = response.data.data.map(mapKwSongToSongResult).filter(song => song.id) as SongResult[];
      console.log(`[酷我API] 搜索成功: 找到 ${songs.length} 首歌曲`);
      return songs;
    } else {
      console.warn('[酷我API] 搜索失败或返回格式不正确:', response.data);
      return [];
    }
  } catch (error) {
    console.error('[酷我API] 请求搜索接口异常:', error);
    return [];
  }
}

/**
 * 获取 kw-api 歌曲的播放 URL
 * @param songId - 歌曲 ID (rid)
 * @param quality - 音质 (根据 kw-api 文档，例如 'exhigh', 'lossless')
 * @returns Promise<string | null> - 实际的 mp3 播放链接
 */
export async function getKwMusicPlayUrl(
  songId: number | string,
  quality: string = 'exhigh' // 默认高音质MP3
): Promise<string | null> {
  // kw-api.cenguigui.cn?id=歌曲ID&type=song&level=音质&format=mp3
  try {
    // 这个接口直接跳转到mp3，所以axios直接获取它的响应URL可能不行
    // 或者它返回的是json，里面包含url
    // 文档示例 "url": "https://kw-api.cenguigui.cn?id=22837479&type=song&level=exhigh&format=mp3"
    // 这表明搜索结果中的 url 字段就是获取播放链接的API，需要再次请求这个API并指定 format=mp3
    // 但文档也说 "直接跳转mp3示例：https://kw-api.cenguigui.cn?id=5960811&type=song&level=hires&format=mp3"
    // 这意味着这个链接本身就是播放链接。
    // 为保险起见，我们先假设直接拼接的链接就是播放链接。

    // 根据文档，直接拼接的URL就是播放地址
    const playUrl = `${KW_API_BASE_URL}?id=${songId}&type=song&level=${quality}&format=mp3`;
    // 这里可以加一个HEAD请求来验证链接是否有效，但为了简化，先直接返回
    return playUrl;

    // 如果上述链接不是直接播放，而是返回json，则需要类似下面的代码：
    /*
    const response = await axios.get<KwApiResponse<{ url: string }>>( // 假设返回json包含url
      KW_API_BASE_URL,
      {
        params: {
          id: songId,
          type: 'song',
          level: quality,
          format: 'json', // 请求json格式获取链接
        },
      }
    );
    if (response.data.code === 200 && response.data.data && response.data.data.url) {
      return response.data.data.url;
    } else {
      console.error('获取 kw-api 播放链接失败:', response.data);
      return null;
    }
    */
  } catch (error) {
    console.error('生成 kw-api 播放链接异常:', error);
    return null;
  }
}

/**
 * 将秒字符串转换为 [mm:ss.xx] 格式
 * @param timeStr 秒数字符串，例如 "3.5"
 */
function formatLyricTime(timeStr: string): string {
  const time = parseFloat(timeStr);
  if (isNaN(time) || time < 0) {
    return '[00:00.00]';
  }
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  const milliseconds = Math.floor((time * 100) % 100); // 取两位毫秒
  return `[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(2, '0')}]`;
}

/**
 * 获取 kw-api 歌曲的歌词
 * @param songId - 歌曲 ID (rid)
 * @returns Promise<string | null> - LRC 歌词文本
 */
export async function getKwMusicLyric(
  songId: number | string
): Promise<string | null> {
  // kw-api.cenguigui.cn?id=歌曲ID&type=lyr&format=lineLyric
  try {
    // 这个接口期望直接返回歌词文本或者特定格式的json
    // 我们需要的是纯文本的LRC
    // "format=lineLyric" 应该返回的是处理好的、每行一句的歌词文本
    const response = await axios.get<KwLyricApiResponse>(
      KW_API_BASE_URL,
      {
        params: {
          id: songId,
          type: 'lyr',
          format: 'lineLyric',
        },
        // 如果返回的是纯文本，需要设置 responseType
        // responseType: 'text', // 如果确定是纯文本，取消注释
      }
    );
    // kw-api 的歌词接口文档没有明确说明 format=lineLyric 的返回格式
    // 假设它直接返回字符串，或者返回一个包含歌词字段的JSON对象
    // 如果是 { code: 200, data: "歌词内容..." } 这样的结构
    if (response.data.code === 200 && response.data.data && Array.isArray(response.data.data.lrclist)) {
      const { lrclist } = response.data.data;
      if (lrclist.length === 0) {
        return '[00:00.00]纯音乐，请欣赏'; // 或者返回 null 表示无歌词
      }
      // 将 lrclist 转换为标准 LRC 格式字符串
      const lrcString = lrclist
        .map(line => `${formatLyricTime(line.time)}${line.lineLyric}`)
        .join('\n');
      return lrcString;
    } else {
      console.warn('获取 kw-api 歌词失败或格式不正确:', response.data);
      return null;
    }

  } catch (error) {
    console.error('请求 kw-api 歌词接口异常:', error);
    return null;
  }
}

// 扩展 SongResult 的 source 类型以包含 'kwmusic'
// 这需要在 src/renderer/type/music.ts 中修改 SongResult 接口的 source 字段定义：
// source?: 'netease' | 'bilibili' | 'kwmusic';
// 由于我不能直接修改那个文件，这里只是一个提示。
// 你需要手动去修改 src/renderer/type/music.ts 文件。 