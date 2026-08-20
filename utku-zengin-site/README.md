# Utku ZENGİN — Kişisel Site

Editoryal, koyu temalı, bölüm bölüm gezinen kişisel site. Blog ve
projeler kısımları Firebase (Auth + Firestore + Storage) ile çalışır.
Site tamamen statik dosyalardan oluşur, GitHub Pages üzerinde
ücretsiz barındırılabilir.

## Dosya yapısı

```
index.html
css/style.css
js/firebase-config.js   ← kendi Firebase bilgilerini buraya yazacaksın
js/app.js                ← tüm site mantığı burada
assets/profile-placeholder.svg  ← kendi fotoğrafınla değiştir
```

## 1) Firebase projesi kur (ücretsiz "Spark" plan yeterli)

1. https://console.firebase.google.com → **Add project** → adını gir (ör. `utku-zengin-site`).
2. Sol menüden **Build → Authentication** → **Get started** →
   **Sign-in method** sekmesinde **Email/Password**'ü etkinleştir.
3. **Authentication → Users** sekmesinden **Add user** ile kendi
   admin e-postanı ve şifreni oluştur. Siteye "kilit" açmak için bu
   bilgileri kullanacaksın.
4. Sol menüden **Build → Firestore Database** → **Create database** →
   production mode → bir bölge seç.
5. Sol menüden **Build → Storage** → **Get started** → production mode.
6. **Project settings (⚙) → General** sekmesinde aşağı in,
   **Your apps** altında **Web (`</>`)** simgesine tıkla, bir takma ad
   ver, "Firebase Hosting" kutucuğunu **işaretleme**. Karşına çıkan
   `firebaseConfig` nesnesindeki değerleri kopyala.

## 2) firebase-config.js dosyasını doldur

`js/firebase-config.js` içindeki `BURAYA_...` yazan her alanı,
az önce kopyaladığın gerçek değerlerle değiştir.

## 3) Güvenlik kuralları

**Firestore Rules** (Firestore Database → Rules):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{collection}/{docId} {
      allow read: if collection in ['posts','projects'];
      allow write: if request.auth != null && collection in ['posts','projects'];

      match /comments/{commentId} {
        allow read: if true;
        allow create: if true;
        allow update, delete: if request.auth != null;
      }
      match /likes/{likeId} {
        allow read: if true;
        allow write: if true;
      }
    }
  }
}
```

**Storage Rules** (Storage → Rules):

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

Bu kurallar: herkes yazı/proje/yorum okuyabilir ve dosya indirebilir
(giriş şart değil), sadece giriş yapmış admin yeni yazı/proje
ekleyebilir, yorum silebilir/düzenleyebilir ve dosya yükleyebilir.
Herkes yorum yazabilir ve beğenebilir.

## 4) Profil fotoğrafını değiştir

`assets/` klasörüne kendi fotoğrafını ekle (ör. `profile.jpg`), sonra
`index.html` içinde `id="profile-img"` olan `<img>` etiketinin `src`
değerini `assets/profile.jpg` olarak güncelle.

## 5) Metinleri düzenle

- **Anasayfa yazısı**: `index.html` → `#view-home` bölümü (epigraf zaten
  isteğine göre yazıldı, istersen değiştirebilirsin).
- **Biyografi**: `index.html` → `#bio-text` bölümü.
- **Bağlantılar**: `index.html` → `.connections-grid` içindeki üç kutu
  (Wikipedia, GitHub, e-posta) — `href` ve kullanıcı adı metinlerini
  kendi bilgilerinle değiştir.

## 6) GitHub Pages'te yayınla

1. Bu dosyaları deponun kök dizinine (veya `/docs` klasörüne) yükle.
2. GitHub'da deponun **Settings → Pages** sekmesine git.
3. **Source** olarak `Deploy from a branch` seç, branch olarak `main`
   (veya kullandığın branch), klasör olarak `/ (root)` (ya da `/docs`)
   seç, **Save**.
4. Birkaç dakika içinde site `https://kullanici-adi.github.io/repo-adi/`
   adresinde yayında olacak.

## Nasıl çalışır (kısa özet)

- **Kilit sistemi**: Blog ve projeler bölümlerindeki kilit ikonuna
  basınca e-posta/şifre sorar, Firebase Authentication ile doğrular.
  Doğruysa kilit açılır, `+` butonu görünür; tekrar basınca çıkış
  yapar ve kilit kapanır.
- **Yorumlar**: Herkes isim + yorum yazıp yayınlayabilir. Giriş
  yapıldığında her yorumun yanında seçim kutucuğu çıkar; bir veya
  daha fazla yorum seçilince toplu **Sil**, tek yorum seçilince ayrıca
  **Düzenle** butonu görünür.
- **Beğeni**: Kalp ikonuna basınca isim sorar, bir isim bir kez
  sayılır (aynı isimle tekrar basmak güncelleme sayılır, sayaç
  artmaz). Sayaç herkese açık; beğenen isimlerin listesi sadece admin
  giriş yaptığında görünür.
- **Projeler**: Dosya indirmek için giriş gerekmez — herkese açık
  indirme bağlantısıdır. Yükleme (ekleme) sadece kilit açıkken
  yapılabilir.
- **Sayfa geçişleri**: Bölümler arasında hash tabanlı yönlendirme
  (`#home`, `#about`, `#blog`, `#projects`, `#post/<id>`) kullanılır,
  her bölüm ayrı ayrı, yumuşak bir giriş animasyonuyla gösterilir —
  hepsi alt alta akmaz.

## Notlar

- Yazı/proje silindiğinde, altındaki yorum ve beğeni alt koleksiyonları
  Firestore tarafında otomatik silinmez (bu, istemci taraflı basit
  sitelerde normal bir sınırlamadır). İstersen ileride bir Cloud
  Function ile otomatikleştirebilirsin.
- Kod, Firebase'in resmi modüler (v10) SDK'sını CDN üzerinden
  kullanır; ekstra bir derleme adımına (npm/webpack vb.) ihtiyaç yoktur.
