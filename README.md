# REG.RU MCP Server

MCP-сервер для **[REG.API 2.0](https://www.reg.ru/reseller/api2doc)**: управление доменами, DNS, услугами, биллингом и DNSSEC через Model Context Protocol (stdio по умолчанию; опционально HTTP Streamable с обязательной аутентификацией).

Официальная документация API: **https://www.reg.ru/reseller/api2doc**

## Возможности

- **Tools** — проверка доменов, DNS-записи, услуги, баланс, DNSSEC, папки
- **Resources** — баланс, активные услуги, цены TLD, DNS-зона домена
- **Prompts** — аудит истекающих услуг, настройка домена под VPS, чеклист миграции

## Требования

- Node.js 18+ (для Docker — Node 20 Alpine)
- Учётная запись [Рег.ру](https://www.reg.ru/) с включённым API
- **Белый список IP** в настройках API личного кабинета (иначе `ACCESS_DENIED_FROM_IP`)

> ⚠️ Если в кабинете не добавлен ни один IP сервера, где крутится MCP, все вызовы будут отклонены. Без whitelist работа с API невозможна.

## Партнёрские методы (Партнёры)

Часть методов REG.API доступна **только партнёрам** (reseller). Обычные клиенты получают `RESELLER_AUTH_FAILED`.

В этом MCP помечены как партнёрские:

| Tool / API | Метод REG.API |
|---|---|
| `regru_check_domains` | `domain/check` |
| `regru_suggest_domains` | `domain/get_suggest` |
| `regru_batch_update_dns` | `zone/update_records` |

Для клиентских аккаунтов используйте одиночные DNS-инструменты (`regru_add_dns_record` / `regru_delete_dns_record`) вместо batch.

## Папки

В официальном API **нет** `folder/get_list`. Доступны: `nop`, `create`, `remove`, `rename`, `get_services`, `add_services`, `remove_services`, `replace_services`, `move_services`, а также `service/get_folders`.

| Tool | Метод |
|---|---|
| `regru_get_folder_services` | `folder/get_services` |
| `regru_get_service_folders` | `service/get_folders` |
| `regru_create_folder` | `folder/create` |
| `regru_add_services_to_folder` | `folder/add_services` |
| `regru_move_services_between_folders` | `folder/move_services` |

## Установка

```bash
git clone https://github.com/AlekMel/regru-mcp-server.git
cd regru-mcp-server
npm install
npm run build
```

Скопируйте `.env.example` в `.env` и укажите учётные данные (для локального запуска через `tsx` / отладки).

### Песочница (sandbox)

Для безопасной проверки синтаксиса запросов:

```bash
REGRU_USERNAME=test
REGRU_PASSWORD=test
```

В режиме `test`/`test` Рег.ру валидирует параметры, но **не** создаёт заказы, **не** меняет DNS и **не** списывает средства.

## Переменные окружения

| Переменная | Обязательно | Описание |
|---|---|---|
| `REGRU_USERNAME` | да | Логин API |
| `REGRU_PASSWORD` | да* | Пароль API (*или ключ) |
| `REGRU_PRIVATE_KEY` | нет | PEM-ключ или путь к файлу (RSA-SHA512 по официальному алгоритму подписи) |
| `REGRU_BASE_URL` | нет | Базовый URL API (по умолчанию `https://api.reg.ru/api/regru2`) |
| `MCP_TRANSPORT` | нет | `stdio` (по умолчанию) или `http` |
| `MCP_AUTH_TOKEN` | да при `http` | Длинный случайный секрет Bearer; без него HTTP **не** стартует |
| `MCP_ALLOWED_IPS` | нет | Список IP/CIDR через запятую; иначе 403 |
| `HOST` | нет | Адрес bind (по умолчанию `0.0.0.0` в HTTP-режиме) |
| `PORT` | нет | Порт HTTP (по умолчанию `3000`) |

Также поддерживается алиас `REGRU_API_BASE_URL`.

Подпись RSA-SHA512 строится по официальному Perl-алгоритму: рекурсивный сбор скалярных значений параметров (включая `username`), пропуск пустых/нулевых/`sig`, лексикографическая сортировка, склейка через `;`, затем RSA-SHA512 + Base64. Подпись считается по **полному** дереву параметров (до `JSON.stringify` для `input_data`). Поля `username` / `password` / `sig` всегда передаются на верхнем уровне формы, не внутри `input_data`.

## Конфигурация Claude Desktop

Файл конфигурации (macOS): `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "regru": {
      "command": "node",
      "args": ["/absolute/path/to/regru-mcp-server/dist/index.js"],
      "env": {
        "REGRU_USERNAME": "your_login",
        "REGRU_PASSWORD": "your_api_password"
      }
    }
  }
}
```

## Конфигурация Cursor

В настройках MCP (`mcp.json` / Cursor Settings → MCP):

```json
{
  "mcpServers": {
    "regru": {
      "command": "node",
      "args": ["/absolute/path/to/regru-mcp-server/dist/index.js"],
      "env": {
        "REGRU_USERNAME": "your_login",
        "REGRU_PASSWORD": "your_api_password"
      }
    }
  }
}
```

После сборки можно вызывать бинарь `regru-mcp-server` из `package.json` (`bin`), если пакет установлен глобально или через `npx`.

## Безопасность / Coolify

**Да: голый публичный HTTP MCP без токена — дыра в безопасности.** Любой, кто достучится до `/mcp`, сможет вызывать инструменты от имени ваших учётных данных REG.RU.

### Обязательно

1. `MCP_TRANSPORT=http`
2. Сильный `MCP_AUTH_TOKEN` (например `openssl rand -hex 32`). Без него процесс **завершится с кодом 1** и не откроет порт.
3. Все запросы к `/mcp` должны содержать заголовок `Authorization: Bearer <тот же токен>`. Сравнение — через `crypto.timingSafeEqual`. Неверный/отсутствующий токен → `401` + `WWW-Authenticate: Bearer` (без утечки деталей).
4. Эндпоинт `/healthz` **без** авторизации: отвечает `200` и телом `ok` (только liveness для Coolify/Docker HEALTHCHECK). MCP там нет.

### Рекомендуется дополнительно

- Firewall Coolify / ограничение входящих портов
- Cloudflare Access (или аналог) перед сервисом
- `MCP_ALLOWED_IPS` — allowlist IP/CIDR клиентов (при отказе → `403`)
- Прокси (Coolify Traefik/Caddy) должен корректно выставлять `X-Forwarded-For`; приложение включает `trust proxy`, чтобы `req.ip` отражал клиента

### Пример клиента с Bearer

```json
{
  "mcpServers": {
    "regru-remote": {
      "url": "https://your-coolify-host.example/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_LONG_RANDOM_MCP_AUTH_TOKEN"
      }
    }
  }
}
```

(Точный формат `url`/`headers` зависит от клиента MCP; важно передать Bearer на каждый запрос к `/mcp`.)

### Docker / Coolify

```bash
# Локально
export MCP_AUTH_TOKEN=$(openssl rand -hex 32)
export REGRU_USERNAME=...
export REGRU_PASSWORD=...
docker compose up --build -d
```

В Coolify: Dockerfile из репозитория, переменные окружения как в таблице выше. **Не деплойте без `MCP_AUTH_TOKEN`.**

### Whitelist IP на стороне Reg.ru

Отдельно от MCP-auth: в личном кабинете REG.RU добавьте **egress IP вашего VPS** в белый список API. Иначе API вернёт `ACCESS_DENIED_FROM_IP`, даже если Bearer к MCP верный.

## Tools

| Tool | Описание |
|---|---|
| `regru_check_domains` | Проверка доступности доменов и цены (**Партнёры**: `domain/check`) |
| `regru_suggest_domains` | Подбор имён по ключевому слову (**Партнёры**) |
| `regru_get_domain_dns` | Текущие NS (делегирование) |
| `regru_update_domain_dns` | Смена NS-серверов |
| `regru_get_dns_records` | Список ресурсных записей зоны |
| `regru_add_dns_record` | Добавить A/AAAA/CNAME/MX/TXT/NS/SRV/CAA |
| `regru_delete_dns_record` | Удалить запись |
| `regru_batch_update_dns` | Пакетное add/delete (**Партнёры**: `zone/update_records`) |
| `regru_list_services` | Список услуг |
| `regru_get_service_info` | Детали услуги |
| `regru_renew_service` | Продление (биллинг) |
| `regru_set_autorenew` | Автопродление вкл/выкл |
| `regru_get_balance` | Баланс аккаунта |
| `regru_get_unpaid_bills` | Неоплаченные счета |
| `regru_manage_dnssec` | status / enable / disable |
| `regru_get_folder_services` | Услуги в папке (`folder/get_services`) |
| `regru_get_service_folders` | Папки услуги (`service/get_folders`) |
| `regru_create_folder` | Создать папку |
| `regru_add_services_to_folder` | Добавить услуги в папку |
| `regru_move_services_between_folders` | Перенос между папками (`folder/move_services`) |

## Resources

| URI | Описание |
|---|---|
| `regru://account/balance` | Текущий баланс |
| `regru://services/active` | Активные услуги |
| `regru://pricing/tlds` | Тарифы регистрации/продления по зонам |
| `regru://domains/{domain}/dns` | DNS-записи зоны |

## Prompts

| Prompt | Назначение |
|---|---|
| `audit_expiring_services` | Услуги, истекающие за 30 дней + баланс |
| `configure_domain_for_vps` | A/www/MX/SPF под IP VPS |
| `domain_migration_check` | NS, DNSSEC и сервис перед переносом |

## Scripts

```bash
npm run build   # компиляция TypeScript → dist/
npm run dev     # запуск через tsx (stdio)
npm test        # unit-тесты (Jest)
npm run lint    # ESLint
```

## Архитектура

- Транспорт MCP: **stdio** (по умолчанию) или **HTTP Streamable** (`MCP_TRANSPORT=http`, эндпоинт `/mcp`)
- HTTP к REG.API: HTTPS POST, `application/x-www-form-urlencoded`, сложные структуры в `input_data` (JSON)
- Аутентификация **не** кладётся внутрь `input_data`
- RSA-подпись по полному дереву параметров (см. [официальные docs](https://www.reg.ru/reseller/api2doc))
- Token-bucket rate limiter (~18 req/min)
- Очередь для биллинг-операций (защита от `BILLING_LOCK`)
- Нормализация IDN → Punycode

## Лицензия

MIT — см. [LICENSE](./LICENSE).
