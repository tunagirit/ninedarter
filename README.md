<p align="center">
  <img src="icons/icon-192.png" width="96" alt="ninedarter logo" />
</p>

<h1 align="center">ninedarter</h1>

<p align="center">
  <b>Material 3 Expressive tasarımlı, tarayıcıda çalışan dart skor uygulaması.</b><br/>
  X01 · Cricket · Antrenman oyunları · Botlar · Detaylı istatistikler · Çevrimdışı PWA
</p>

<p align="center">
  <a href="https://tunagirit.github.io/ninedarter/"><b>▶ Uygulamayı aç</b></a> ·
  <a href="#english">English</a>
</p>

---

## Özellikler

### Oyunlar
- **Maç Oyna (X01)** — 301 / 501 / 701 / 1001 veya özel başlangıç skoru
  - Giriş: Straight / Double / Master in · Çıkış: Double / Straight / Master out
  - “İlk N” veya “En iyi N” formatı, **leg** ya da **set** modu
  - 8 oyuncuya kadar veya **takım modu** (2–4 takım), leg/set başlangıcı otomatik döner
- **Cricket** — dört oyun türü, **cezalı mod** (cut-throat) açılıp kapatılabilir, takım modu, tur limiti, çoklu leg
  - **Cricket:** 20–15 ve Bull
  - **Fullboard:** 20–10, Bull, Double, Triple ve House (iç bull); 10 ve 11 isteğe bağlı olarak çıkarılabilir
  - **Tactics:** Fullboard + Double, Triple ve Bull (house)
  - **Akyaka:** sıralı Cricket — önce 20, sonra 19 … 15, en son toplam 3 Bull; sıradaki hedef kapanmadan diğerleri işlemez
- **Antrenman**
  - **121 Checkout** — 9 dartta bitir, hedef yükselsin
  - **Saat Yönünde** (Around the Clock) — herhangi / double / triple hedefler, Bull ile bitiş
  - **Bob's 27** — double antrenmanı
  - **Doubles Training** — D1–D20 ve Bull'a 3'er dart
  - **Rastgele Checkout** — seçilen aralıkta rastgele bitirişler, önerilen rota ile
  - **Shanghai** — 1–7 veya 1–20; single + double + triple = anında galibiyet
  - **Akyaka** — sıralı Cricket (Cricket ekranından da seçilebilir)

### Skor girişi
- **Toplam skor tuş takımı** — hızlı skor tuşları (26, 45, 60, 81, 100, 140, 180), fiziksel klavye desteği
- **Dart dart giriş** — Tek / Double / Triple seçimi + tahta numaraları, otomatik bust ve checkout algılama
- İmkânsız skorların (163, 166, 169, 172…) ve geçersiz bitirişlerin engellenmesi
- Checkout'ta kullanılan dart ve double'a atılan dart sayısı (doğru checkout % için)
- Sınırsız **geri al**

### Botlar
11 seviyeli bilgisayar rakibi: X01'de ~25 → ~107 ortalama, Cricket'te ~0.5 → ~4.6 MPR. Botlar gerçek bir dart tahtası geometrisi üzerinde, seviyeye göre sapma ile atış simüle eder ve checkout rotalarını takip eder. X01 ve Cricket'te kullanılabilir.

### İstatistikler
- 3 dart ortalaması, ilk 9 ortalaması, checkout %, en yüksek bitiriş, en iyi leg, 180 / 140+ / 100+ / 60+
- Cricket MPR (tur başına işaret), 5+ işaretli turlar
- Antrenman rekorları ve gelişim grafikleri
- Canlı maç istatistiği, maç sonu karşılaştırma tablosu ve leg dökümü
- Maç geçmişi, rövanş

### Hesap ve profil (v1.0.1)
- **Hesap sistemi** — e-posta, kullanıcı adı ve şifre ile kayıt; e-posta doğrulama; **şifremi unuttum** bağlantısı
- **Profil** — profil fotoğrafı, kullanıcı adı, ortalamalar ve özet istatistikler
- **Bulut senkronizasyonu** — maçlar ve istatistikler hesaba yedeklenir, cihazlar arasında eşitlenir; hesap açmadan önceki maçlar hesaba taşınır
- **Çevrimiçi arkadaşlar** — kullanıcı adıyla arkadaş ekleme; arkadaşla oynanan maç iki tarafın geçmişine de düşer
- **Çevrimdışı oyuncular** — Ayarlar'dan kayıtlı oyuncu isimleri; oyun kurarken Arkadaşlar / Çevrimdışı / Bot sekmelerinden seçim
- Hesap açmadan da uygulama tamamen çevrimdışı çalışır

### Diğer
- **Checkout önerileri** (2–170, kalan dart sayısına göre)
- **Sesli skor anonsu** (Web Speech API — “One hundred and eighty!”)
- Yarım kalan maçı sonra sürdürme
- Türkçe / English arayüz
- Ayarlardan **uygulama olarak yükleme** (PWA)
- Açık / koyu / sistem teması ve özelleştirilebilir tema rengi (dinamik renk)
- JSON yedekleme / geri yükleme
- **PWA** — ana ekrana eklenebilir, çevrimdışı çalışır. Tüm veriler yalnızca cihazınızda (localStorage) saklanır.

## Tasarım: Material 3 Expressive

- OKLCH ile tek bir tohum renkten üretilen tonal renk şeması (açık + koyu)
- Ekspresif şekiller: cookie, flower, clover, burst… avatarlar ve dekorlar; aktif oyuncu kartında şekil dönüşümü
- Basıldığında şekil değiştiren butonlar, bağlı buton grupları (connected button groups)
- Yay (spring) tabanlı hareket eğrileri, dalgalı (wavy) ilerleme göstergesi
- Roboto Flex değişken yazı tipi ile vurgulu (emphasized) tipografi
- Mobilde navigation bar, geniş ekranda navigation rail

## Çalıştırma

Derleme adımı yoktur — saf HTML/CSS/JS (ES modules) + gömülü [Preact](https://preactjs.com/) + [htm](https://github.com/developit/htm).

```bash
git clone https://github.com/tunagirit/ninedarter.git
cd ninedarter
npx serve .        # veya: python -m http.server
```

Ardından `http://localhost:3000` (veya ilgili port) adresini açın. Service worker ve ES modülleri nedeniyle `file://` ile değil, bir HTTP sunucusu üzerinden açılmalıdır.

## Proje yapısı

```
index.html             Uygulama kabuğu
css/app.css            M3 Expressive tasarım sistemi (token'lar, bileşenler, hareket)
js/darts.js            Tahta geometrisi, checkout tablosu, bust kuralları
js/bot.js              Bot seviyeleri ve atış simülasyonu
js/engines/            X01, Cricket ve antrenman motorları (aksiyon kaydından yeniden hesaplanır → kolay geri alma)
js/screens/            Ekranlar (ana sayfa, kurulum, oyun, sonuç, istatistik, oyuncular, ayarlar)
js/store.js            localStorage tabanlı kalıcı durum
js/cloud.js            Supabase: hesap, şifre sıfırlama, senkronizasyon, arkadaşlar
supabase/schema.sql    Veritabanı şeması ve güvenlik kuralları (RLS)
js/i18n.js             TR / EN çeviriler
sw.js                  Çevrimdışı önbellek
```

## Kendi Supabase projenle çalıştırma

Hesap özellikleri [Supabase](https://supabase.com) kullanır (ücretsiz plan yeterli):

1. Yeni bir proje aç, **SQL Editor**'da [`supabase/schema.sql`](supabase/schema.sql) dosyasını çalıştır.
2. **Authentication → URL Configuration**: Site URL ve Redirect URLs'e kendi site adresini ekle.
3. **Authentication → Emails → SMTP Settings**: e-posta göndermek için bir SMTP sağlayıcısı tanımla (yerleşik servis yalnızca ekip üyelerine gönderir).
4. [`js/config.js`](js/config.js) içine proje URL'sini ve `anon` anahtarını yaz. `config.js` boş bırakılırsa uygulama tamamen çevrimdışı çalışır.

## Lisans

[MIT](LICENSE)

---

## English

**ninedarter** is a free, open-source darts scorer with a Material 3 Expressive design that runs entirely in the browser.

- **Games:** X01 (301–1001/custom, straight/double/master in & out, first-to/best-of, legs & sets), Cricket (standard & cut-throat), Around the Clock, Bob's 27, Checkout practice
- **Input:** visit-total keypad with quick scores or dart-by-dart entry, automatic bust/checkout detection, unlimited undo
- **Bots:** 11 levels (~25 to ~107 average) simulated on real board geometry
- **Stats:** 3-dart average, first-9, checkout %, high finish, best leg, ton counts, cricket MPR, training records, trend charts, match history
- **Extras:** checkout hints, voice caller, resume matches, TR/EN, light/dark & dynamic color, JSON backup, installable offline PWA. All data stays on your device.

Run it with any static server (`npx serve .`) — no build step required.
