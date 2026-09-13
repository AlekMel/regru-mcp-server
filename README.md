# REG.RU MCP Server

MCP-сервер для [REG.API 2.0](https://www.reg.ru/reseller/api2doc): управление доменами, DNS, услугами, биллингом и DNSSEC через Model Context Protocol (stdio).

## Возможности

- **Tools** — проверка доменов, DNS-записи, услуги, баланс, DNSSEC, папки
- **Resources** — баланс, активные услуги, цены TLD, DNS-зона домена
- **Prompts** — аудит истекающих услуг, настройка домена под VPS, чеклист миграции

## Требования

- Node.js 18+
- Учётная запись [Рег.ру](https://www.reg.ru/) с включённым API
- **Белый список IP** в настройках API личного кабинета (иначе `ACCESS_DENIED_FROM_IP`)

> ⚠️ Если в кабинете не добавлен ни один IP сервера, где крутится MCP, все вызовы будут отклонены.

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
| `REGRU_PRIVATE_KEY` | нет | PEM-ключ или путь к файлу (RSA-SHA512) |
| `REGRU_BASE_URL` | нет | Базовый URL API (по умолчанию `https://api.reg.ru/api/regru2`) |

Также поддерживается алиас `REGRU_API_BASE_URL`.

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

## Tools

| Tool | Описание |
|---|---|
| `regru_check_domains` | Проверка доступности доменов и цены |
| `regru_suggest_domains` | Подбор имён по ключевому слову |
| `regru_get_domain_dns` | Текущие NS (делегирование) |
| `regru_update_domain_dns` | Смена NS-серверов |
| `regru_get_dns_records` | Список ресурсных записей зоны |
| `regru_add_dns_record` | Добавить A/AAAA/CNAME/MX/TXT/NS/SRV/CAA |
| `regru_delete_dns_record` | Удалить запись |
| `regru_batch_update_dns` | Пакетное add/delete |
| `regru_list_services` | Список услуг |
| `regru_get_service_info` | Детали услуги |
| `regru_renew_service` | Продление (биллинг) |
| `regru_set_autorenew` | Автопродление вкл/выкл |
| `regru_get_balance` | Баланс аккаунта |
| `regru_get_unpaid_bills` | Неоплаченные счета |
| `regru_manage_dnssec` | status / enable / disable |
| `regru_list_folders` | Список папок |
| `regru_create_folder` | Создать папку |
| `regru_move_service_to_folder` | Перенести услугу в папку |

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

- Транспорт MCP: **stdio** (`@modelcontextprotocol/sdk`)
- HTTP к REG.API: HTTPS POST, `application/x-www-form-urlencoded`, сложные структуры в `input_data` (JSON)
- Аутентификация **не** кладётся внутрь `input_data`
- Token-bucket rate limiter (~18 req/min)
- Очередь для биллинг-операций (защита от `BILLING_LOCK`)
- Нормализация IDN → Punycode

## Лицензия

MIT — см. [LICENSE](./LICENSE).
