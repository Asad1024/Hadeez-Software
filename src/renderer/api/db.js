const api = window.electronAPI;

export const dbRun = (sql, params = []) => api?.dbRun(sql, params) ?? Promise.resolve({ error: 'API not available' });
export const dbGet = (sql, params = []) => api?.dbGet(sql, params) ?? Promise.resolve({ error: 'API not available' });
export const dbAll = (sql, params = []) => api?.dbAll(sql, params) ?? Promise.resolve({ error: 'API not available' });
export const getDataPath = () => api?.getDataPath() ?? Promise.resolve('');

export const unwrap = (result) => {
  if (result?.error) throw new Error(result.error);
  return result?.data ?? result;
};
