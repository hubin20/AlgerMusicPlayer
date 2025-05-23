import request from '@/utils/request';

interface IParams {
  keywords: string;
  type: number;
  limit?: number;
  offset?: number;
}

/**
 * 搜索内容
 * @param params 搜索参数
 * @returns API响应
 */
export const getSearch = async (params: IParams) => {
  try {
    console.log(`[搜索API] 开始请求: 关键词=${params.keywords}, 类型=${params.type}, 限制=${params.limit}, 偏移=${params.offset}`);

    // 确保参数有效
    if (!params.keywords) {
      console.warn('[搜索API] 搜索关键词为空');
      return { data: { result: null, code: 400 } };
    }

    // 添加重试机制
    let retries = 0;
    const maxRetries = 3;
    let response;

    while (retries < maxRetries) {
      try {
        response = await request.get<any>('/cloudsearch', {
          params,
          // 移除导致CORS问题的自定义请求头
          // headers: {
          //   'Cache-Control': 'no-cache',
          //   'Pragma': 'no-cache'
          // }
        });

        // 检查响应数据是否有效
        if (response.data && response.data.result) {
          console.log(`[搜索API] 请求成功: 类型=${params.type}, 结果数量=${getResultCount(response.data.result, params.type)}`);
          return response;
        } else {
          console.warn(`[搜索API] 尝试 ${retries + 1}/${maxRetries}: 响应数据无效:`, response.data);
          retries++;
          if (retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒再重试
          }
        }
      } catch (err) {
        console.error(`[搜索API] 尝试 ${retries + 1}/${maxRetries} 失败:`, err);
        retries++;
        if (retries < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒再重试
        }
      }
    }

    // 如果所有重试都失败
    console.error(`[搜索API] 经过 ${maxRetries} 次尝试后仍然失败`);
    return { data: { result: null, code: 500 } };
  } catch (error) {
    console.error('[搜索API] 请求失败:', error);
    // 返回一个有效的响应结构，避免调用方出错
    return { data: { result: null, code: 500 } };
  }
};

/**
 * 获取不同类型搜索结果的数量
 * @param result 搜索结果
 * @param type 搜索类型
 * @returns 结果数量
 */
function getResultCount(result: any, type: number): number {
  if (!result) return 0;

  // 根据不同类型获取结果数量
  switch (type) {
    case 1: // 单曲
      return result.songs?.length || 0;
    case 10: // 专辑
      return result.albums?.length || 0;
    case 1000: // 歌单
      return result.playlists?.length || 0;
    case 1004: // MV
      return result.mvs?.length || 0;
    default:
      return Object.values(result).reduce((count: number, item: any) => {
        return count + (Array.isArray(item) ? item.length : 0);
      }, 0);
  }
}
