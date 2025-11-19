# Быстрый старт для npm-пакета

## Что это?

Это npm-пакет-обертка, который автоматически скачивает бинарник repo2txt из GitHub Releases при установке.

## Структура

```
npm-package/
├── package.json      # Конфигурация npm-пакета
├── install.js        # Скрипт для скачивания бинарника
├── bin/
│   └── run.js        # Обертка для запуска бинарника
├── README.md         # Документация для npm
├── PUBLISH.md        # Инструкции по публикации
└── .npmignore        # Игнорируемые файлы при публикации
```

## Как это работает

1. Пользователь выполняет `npm install -g repo2txt`
2. npm запускает `postinstall` скрипт (`install.js`)
3. Скрипт определяет платформу (Windows/macOS/Linux) и архитектуру (x64/arm64)
4. Скачивает соответствующий архив (tar.gz или zip) из GitHub Releases
5. Распаковывает архив и извлекает бинарник
6. Сохраняет бинарник в `bin/` и делает исполняемым
7. Пользователь может запускать `repo2txt` из командной строки

## Требования для публикации

Перед публикацией убедитесь, что:

1. ✅ Архивы собраны и опубликованы на GitHub Releases
2. ✅ Имена архивов соответствуют формату: `repo2txt_{version}_{target}.{tar.gz|zip}`
3. ✅ Внутри каждого архива есть бинарник `repo2txt` (или `repo2txt.exe`)
4. ✅ Версия в `package.json` совпадает с версией релиза
5. ✅ Репозиторий указан правильно в `package.json`

## Формат имен архивов

GitHub Releases должны содержать архивы:

- `repo2txt_2.0.0_x86_64-apple-darwin.tar.gz` (macOS Intel)
- `repo2txt_2.0.0_aarch64-apple-darwin.tar.gz` (macOS Apple Silicon)
- `repo2txt_2.0.0_x86_64-unknown-linux-gnu.tar.gz` (Linux x64)
- `repo2txt_2.0.0_aarch64-unknown-linux-gnu.tar.gz` (Linux ARM64)
- `repo2txt_2.0.0_x86_64-pc-windows-msvc.zip` (Windows x64)
- `repo2txt_2.0.0_aarch64-pc-windows-msvc.zip` (Windows ARM64)

## Тестирование локально

```bash
cd npm-package

# Создайте tarball
npm pack

# Установите локально (в другой директории)
cd /tmp
npm install /path/to/repo2txt/npm-package/repo2txt-2.0.0.tgz

# Проверьте работу
npx repo2txt --help
```

## Публикация

См. подробные инструкции в [PUBLISH.md](./PUBLISH.md)

