import axios, { InternalAxiosRequestConfig } from 'axios';

import { useUserStore } from '@/store/modules/user';

import { getSetData, isElectron } from '.';

let setData: any = null;

// 扩展请求配置接口
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  retryCount?: number;
}

const baseURL = window.electron
  ? `http://127.0.0.1:${setData?.musicApiPort}`
  : 'https://api.931125.xyz';

const request = axios.create({
  baseURL,
  timeout: 30000,
  withCredentials: true
});

// 最大重试次数
const MAX_RETRIES = 5;
// 重试延迟（毫秒）
const RETRY_DELAY = 1000;

// 请求拦截器
request.interceptors.request.use(
  (config: CustomAxiosRequestConfig) => {
    setData = getSetData();
    config.baseURL = window.electron
      ? `http://127.0.0.1:${setData?.musicApiPort}`
      : 'https://api.931125.xyz';
    // 只在retryCount未定义时初始化为0
    if (config.retryCount === undefined) {
      config.retryCount = 0;
    }

    // 添加调试日志，但减少日志内容避免跨域问题
    console.log(`[API请求] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);

    // 在请求发送之前做一些处理
    // 在get请求params中添加timestamp
    config.params = {
      ...config.params,
      timestamp: Date.now()
    };

    // 移除可能导致CORS问题的请求头
    if (config.headers) {
      delete config.headers['Pragma'];
      delete config.headers['Cache-Control'];
    }

    const token = localStorage.getItem('token');
    if (token && config.method !== 'post') {
      config.params.cookie = config.params.cookie !== undefined ? config.params.cookie : token;
    } else if (token && config.method === 'post') {
      config.data = {
        ...config.data,
        cookie: token
      };
    }
    if (isElectron) {
      const proxyConfig = setData?.proxyConfig;
      if (proxyConfig?.enable && ['http', 'https'].includes(proxyConfig?.protocol)) {
        config.params.proxy = `${proxyConfig.protocol}://${proxyConfig.host}:${proxyConfig.port}`;
      }
      if (setData.enableRealIP && setData.realIP) {
        config.params.realIP = setData.realIP;
      }
    }

    return config;
  },
  (error) => {
    // 当请求异常时做一些处理
    console.error('[API请求错误]', error);
    return Promise.reject(error);
  }
);

const NO_RETRY_URLS = ['暂时没有'];

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    // 添加调试日志，但减少日志内容避免跨域问题
    console.log(`[API响应] ${response.config.method?.toUpperCase()} ${response.config.url}`, {
      status: response.status
    });
    return response;
  },
  async (error) => {
    console.error('[API响应错误]', error.message, error.config?.url);

    // 添加更详细的错误信息
    if (error.response) {
      console.error('[API响应详情]', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    } else if (error.request) {
      console.error('[API请求未收到响应]', error.request);
    }

    const config = error.config as CustomAxiosRequestConfig;

    // 如果没有配置，直接返回错误
    if (!config) {
      return Promise.reject(error);
    }

    // 处理 301 状态码
    if (error.response?.status === 301 && config.params.noLogin !== true) {
      // 使用 store mutation 清除用户信息
      const userStore = useUserStore();
      userStore.handleLogout();
      console.log(`[API] 301 状态码，清除登录信息后重试第 ${config.retryCount} 次`);
      config.retryCount = 3;
    }

    // 检查是否还可以重试
    if (
      config.retryCount !== undefined &&
      config.retryCount < MAX_RETRIES &&
      !NO_RETRY_URLS.includes(config.url as string)
    ) {
      config.retryCount++;
      console.log(`[API] 请求重试第 ${config.retryCount} 次: ${config.url}`);

      // 延迟重试
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));

      // 重新发起请求
      return request(config);
    }

    console.error(`[API] 重试${MAX_RETRIES}次后仍然失败: ${config.url}`);
    return Promise.reject(error);
  }
);

export default request;
