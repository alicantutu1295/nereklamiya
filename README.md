# BetterBlock

BetterBlock, Manifest V3 tabanlı bir Chromium reklam ve izleyici engelleyici prototipidir.

## Özellikler

- Ağ seviyesinde reklam ve izleyici engelleme
- Popup üzerinden korumayı açma/kapatma
- Kozmetik filtreleme ile sayfada kalan reklam alanlarını gizleme
- Aktif sekmede yenilenene kadar geçici durdurma
- Günlük ve toplam engelleme sayacı
- EasyList benzeri basit filtre dosyalarından kural üretme

## Chromium'a yükleme

1. Chrome, Edge veya Brave içinde `chrome://extensions` adresini açın.
2. Sağ üstten `Developer mode` seçeneğini açın.
3. `Load unpacked` butonuna basın.
4. Bu klasörü seçin: `c:\Users\Alican\Desktop\Eklenti`

## Dosya yapısı

```text
manifest.json
package.json
filters/network.txt
filters/cosmetic.txt
rules/core-rules.json
tools/build-rules.js
src/background.js
src/content.js
src/generated-cosmetic-rules.js
src/popup.html
src/popup.css
src/popup.js
```

## Filtreleri derleme

`filters/network.txt` ve `filters/cosmetic.txt` dosyalarını düzenledikten sonra:

```powershell
npm run build:rules
```

Bu komut şu dosyaları üretir:

- `rules/core-rules.json`
- `src/generated-cosmetic-rules.js`

Bu sistem için Node.js gerekir. Node.js yoksa eklenti mevcut üretilmiş dosyalarla yine yüklenebilir.

## Sonraki geliştirme fikirleri

- Element seçici ile manuel kozmetik kural oluşturma
- Kuralları kategori bazlı açma/kapatma
- Daha ayrıntılı engelleme geçmişi
