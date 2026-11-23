// Public, allowlisted diagnostics. Never return upstream responses, SQL, codes or tokens.
export const AUTH_MESSAGES: Record<string, string> = {
  config:
    'Вход через Яндекс не настроен на сервере. Администратору нужно проверить OAuth-ключи и адрес сайта.',
  state:
    'Проверка входа истекла или потерялась. Откройте сайт в обычной вкладке, разрешите cookie и повторите вход.',
  cancelled:
    'Вход через Яндекс отменён. Можно попробовать снова или войти другим способом.',
  token:
    'Яндекс не подтвердил вход. Повторите попытку; если ошибка повторяется, администратору нужно проверить настройки OAuth.',
  unavailable:
    'Сервер авторизации Яндекса временно недоступен. Попробуйте позже или войдите другим способом.',
  profile:
    'Не удалось получить профиль и почту из Яндекс ID. Проверьте разрешения приложения в Яндексе.',
  schema:
    'Вход недоступен: база данных сайта требует обновления. Администратору нужно применить SQL-миграции Supabase.',
  database:
    'Не удалось подключиться к базе аккаунтов. Попробуйте позже; администратору нужно проверить подключение к БД.',
  session:
    'Не удалось создать сессию. Администратору нужно проверить SESSION_SECRET на сервере.',
  blocked: 'Аккаунт заблокирован. Обратитесь к администратору сайта.',
  failed:
    'Не удалось выполнить вход через провайдера. Попробуйте ещё раз или выберите другой способ входа.',
};
export const authErrorMessage = (reason: string | null) =>
  Object.hasOwn(AUTH_MESSAGES, reason || '')
    ? AUTH_MESSAGES[reason!]
    : AUTH_MESSAGES.failed;

// Drizzle wraps PostgreSQL errors in `cause`; inspect only safe SQLSTATE codes.
export function databaseErrorCode(error: unknown): string | undefined {
  const seen = new Set<unknown>();
  let current = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    if (
      'code' in current &&
      typeof current.code === 'string' &&
      /^[A-Z0-9]{5}$/.test(current.code)
    )
      return current.code;
    current = 'cause' in current ? current.cause : undefined;
  }
  return undefined;
}
export function isAuthSchemaError(error: unknown) {
  return ['42703', '42P01'].includes(databaseErrorCode(error) || '');
}
