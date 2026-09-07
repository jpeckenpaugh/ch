import { error } from './validation.js';

const SETTING_KEY = /^[a-z0-9][a-z0-9._-]{0,127}$/i;

function key(value) {
  if (typeof value !== 'string' || !SETTING_KEY.test(value)) throw error(422, 'Invalid setting key');
  return value;
}

export function registerSettings({register, query, run}) {
  register('settings.get', ({key: settingKey}) => query('SELECT value FROM workspace_settings WHERE key = ?', [key(settingKey)])[0] || null);
  register('settings.set', ({data}) => {
    const settingKey = key(data?.key);
    if (typeof data?.value !== 'string' || !data.value.trim()) throw error(422, 'A setting value is required');
    run(`INSERT INTO workspace_settings(key, value, updated_at) VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`, [settingKey, data.value.trim()]);
    return {key: settingKey};
  }, true);
  register('settings.delete', ({data}) => {
    run('DELETE FROM workspace_settings WHERE key = ?', [key(data?.key)]);
    return null;
  }, true);
}
