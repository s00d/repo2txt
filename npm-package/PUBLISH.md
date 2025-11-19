# Инструкция по публикации npm-пакета

## Подготовка

1. **Обновите информацию в `package.json`**:
   - Укажите правильный `repository.url` с вашим GitHub репозиторием
   - Убедитесь, что версия соответствует версии бинарников в GitHub Releases

2. **Настройте конфигурацию репозитория** (опционально):
   
   Добавьте в `package.json` секцию `repo2txt`:
   ```json
   {
     "repo2txt": {
       "owner": "s00d",
       "repo": "repo2txt",
       "version": "2.0.0"
     }
   }
   ```

3. **Убедитесь, что архивы опубликованы на GitHub Releases**:
   
   Структура должна быть:
   ```
   v2.0.0/
     - repo2txt_2.0.0_x86_64-apple-darwin.tar.gz
     - repo2txt_2.0.0_aarch64-apple-darwin.tar.gz
     - repo2txt_2.0.0_x86_64-unknown-linux-gnu.tar.gz
     - repo2txt_2.0.0_aarch64-unknown-linux-gnu.tar.gz
     - repo2txt_2.0.0_x86_64-pc-windows-msvc.zip
     - repo2txt_2.0.0_aarch64-pc-windows-msvc.zip
   ```
   
   **Важно**: Внутри каждого архива должен находиться бинарник `repo2txt` (или `repo2txt.exe` на Windows) в корне архива или в подпапке.

4. **Подпишите архивы GPG-ключом** (рекомендуется):
   
   Для каждого архива создайте файл подписи:
   ```bash
   gpg --detach-sign --armor repo2txt_2.0.0_<target>.tar.gz
   # Создаст файл repo2txt_2.0.0_<target>.tar.gz.sig
   ```
   
   Загрузите файлы `.sig` вместе с архивами в GitHub Releases.
   
   Убедитесь, что ваш GPG-ключ добавлен в GitHub:
   - Settings → SSH and GPG keys → New GPG key
   - Или используйте `https://github.com/<username>.gpg` для автоматического импорта

## Публикация

### Первая публикация

```bash
cd npm-package

# Проверьте, что всё правильно
npm pack --dry-run

# Войдите в npm (если еще не вошли)
npm login

# Опубликуйте
npm publish
```

### Обновление версии

```bash
cd npm-package

# Обновите версию в package.json
npm version patch  # или minor, major

# Опубликуйте новую версию
npm publish
```

## Тестирование перед публикацией

### Локальное тестирование

```bash
cd npm-package

# Создайте tarball для тестирования
npm pack

# Установите локально в другой директории
cd /tmp
npm install /path/to/repo2txt/npm-package/repo2txt-2.0.0.tgz

# Проверьте работу
npx repo2txt --help
```

### Тестирование с npx

После публикации можно протестировать без установки:

```bash
npx repo2txt@latest --help
```

## Важные замечания

1. **Версии должны совпадать**: Версия в `package.json` должна соответствовать версии тега в GitHub Releases (например, `v2.0.0`)

2. **Бинарники должны быть доступны**: Убедитесь, что GitHub Releases публичны и бинарники доступны для скачивания

3. **Подписи**: Скрипт `install.js` автоматически проверяет GPG-подписи, если файлы `.sig` доступны. Если подпись не найдена, установка продолжается с предупреждением.

4. **Права на исполнение**: Скрипт `install.js` автоматически устанавливает права на исполнение для Unix-систем

5. **Имя пакета**: Убедитесь, что имя `repo2txt` свободно на npm. Если занято, используйте `@your-scope/repo2txt`

## Автоматизация через GitHub Actions

Можно настроить автоматическую публикацию при создании GitHub Release:

```yaml
name: Publish to npm

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      - run: |
          cd npm-package
          npm version ${{ github.event.release.tag_name }} --no-git-tag-version
          npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Troubleshooting

### Ошибка "Binary not found"

- Проверьте, что архивы опубликованы на GitHub Releases
- Убедитесь, что имена архивов соответствуют формату: `repo2txt_{version}_{target}.{tar.gz|zip}`
- Проверьте, что внутри архива есть бинарник `repo2txt` (или `repo2txt.exe`)
- Проверьте, что версия в `package.json` совпадает с версией релиза
- Убедитесь, что команда `tar` доступна (Windows 10+, macOS, Linux)

### Ошибка при скачивании

- Проверьте интернет-соединение
- Убедитесь, что GitHub Releases публичны
- Проверьте правильность URL в `install.js`

