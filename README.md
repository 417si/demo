# La Magica＊Prism Ceremony — MKP 2026 公演サイト

> **サイトの構成が変わりました**：トップ（`index.html`）は「本の表紙をひらくと公演写真ギャラリーが出てくる」新しいサイトです。
> 今までの特設サイトは `old/` に残してあります（`/old/`）。下の説明のうち、トップ・About・ギャラリーの部分は旧サイト（`old/`）の話です。

武蔵野美術大学公認サークル Magic Kingdom Project の 2026年度 芸術祭公演サイトです。
ビルド不要の静的サイト（HTML / CSS / JS）なので、置くだけで公開できます。

**動画はすべてサイト内の mp4 ファイルを再生しています。** YouTube や X の埋め込みは使っていないので、
ロゴや「Xで見る」などの表示は出ず、ページを開くとそのまま自動再生されます。

---

## 公開前チェックリスト

- [ ] グッズの告知画像ができたら `assets/goods/` に置き、`data/content.js` の `goods.image` にパスを書く
- [ ] 観覧のお願い（`notes`）・各班の紹介文（`about.teams` の desc）を今年用に見直す
- [ ] 公開URLが決まったら `index.html` / `about.html` の `og:image` を絶対URLにする
      （例: `https://mkp26.com/assets/img/ogp.jpg`）※Xでリンクを貼ったときの画像表示に必要

---

## フォルダ構成

```
index.html            トップ：本の表紙（ポスター）→ タップでひらくと、公演写真ギャラリー（メニューはハンバーガー）
about.html            以前のURL → index.html#about（トップのAboutパネル）へ転送するだけ
gallery.html          以前のギャラリーのURL → index.html#gallery へ転送するだけ
app/                  ★ 新しいトップの見た目と動き（site.css / landing.* / gallery.* / panels.js）
old/                  旧サイト（index.html / about.html / gallery.html）。画像・css/・js/・data/ はルートのものを共有（<base href="../">）
edit.html / tagger/   タグ修正ページ・スマホ管理ページ（ルートのまま）
album/                思い出アルバム風のページ（試作。今は使っていません）
upload.html           部員用の写真投稿ページ（合言葉で入る。メニューには出ないのでURLを部員に共有）
gas/Code.gs           写真のデータベース（Google Apps Script に貼り付けて使う）
js/gallery-core.js    ギャラリーと投稿ページ共通（データベースとの通信・画像の圧縮）
js/gallery.js / js/upload.js / css/gallery.css   それぞれのページの動きと見た目
js/vendor/heic-to.js  HEIC（iPhoneの写真形式）を読むためのライブラリ（heic-to 1.5.2・LGPL。消さないでください）
data/content.js       ★ 文章・データ・動画の指定はぜんぶここ。普段はこれだけ編集すればOK
css/style.css         見た目。色や書体は先頭の :root の変数で一括変更
js/main.js            動き（content.js の中身をページに流し込む処理）
assets/videos/        テーマ映像・キャラ紹介動画（mp4）と、読み込み中に出す画像（jpg）
assets/img/           ポスター・ファビコン・OGP画像
assets/goods/         グッズ画像を置く場所
assets/svg/           姫の紋章・銀の額縁・きらめき・羊皮紙・植物の帯などの装飾
tools/make_assets.py      装飾SVGを作り直すスクリプト（色を変えたいとき）
tools/optimize_images.py  ポスター差し替え時に軽い版とOGP画像を作るスクリプト
```

---

## よくある更新

### キャラクター紹介動画を追加する
1. 動画を `assets/videos/chara5.mp4` のように置く（mp4 / H.264 がいちばん確実。1本10MB前後までが目安）
2. 読み込み中に出す画像を `assets/videos/chara5.jpg` として置く（なくてもOK）
3. `data/content.js` の `characters` に1ブロック追加：

```js
{
  label: "〇〇 & △△",
  names: [
    { role: "〇〇の", name: "〇〇" },
    { role: "△△の", name: "△△" },
  ],
  video: "assets/videos/chara5.mp4",
  poster: "assets/videos/chara5.jpg",
  color: "#8A55C8",
},
```

動画は画面に入ると音なしで自動再生し、終わると次のキャラへ自動で進みます。
下には何本目かを示す細いバーと「1 / 22」のような番号だけが出るので、本数が増えても画面がうるさくなりません（`label` は画面には出ない読み上げ用の名前です）。右下のスピーカーのアイコンで音が出ます。

> 動画の1コマを画像にしたいとき（ffmpeg がある場合）:
> `ffmpeg -ss 5 -i assets/videos/chara5.mp4 -frames:v 1 -vf scale=1280:-2 assets/videos/chara5.jpg`

### テーマ映像（最初に流れる動画）を差し替える
`assets/videos/theme.mp4` を上書きするだけ。`intro.enabled: false` でオープニングなしにできます。
- ブラウザの決まりで、自動再生は**音なし**から始まります（画面左下のスピーカーのアイコンで音が出ます）
- 終わる / Skip / Esc でポスターに切り替わります。同じタブでは2回目以降は流れません
- ポスター下の「テーマ映像をもう一度見る」からは音ありで再生されます

### グッズを載せる
告知画像を `assets/goods/goods.jpg` のように置いて、`goods.image: "assets/goods/goods.jpg"` と書くだけ。
空のあいだは「Coming soon」の枠が出ます。画像はクリックで拡大できます。

### お知らせ欄（必要になったら）
`news: []` に `{ date: "2026-10-20", text: "〇〇しました", url: "#goods" },` を入れると公演情報の下に表示されます。

### メインビジュアル（ポスター）の見せ方
ポスターを画面いっぱいの背景として表示します。公演日時はその下に出て、「ポスター全体を見る」ボタンで全体を拡大表示できます。
  - PC（横長の画面）：横幅いっぱいのまま、ポスターの `hero.pcFrom`%〜`hero.pcTo`%（今は 2〜66＝姫の頭の上〜タイトル文字）を縦に並べ、ページと一緒にスクロールして見せます。
  - スマホ（縦長の画面）：横幅に合わせてポスター全体を表示し、`hero.focus` → `hero.focusEnd` へ少しだけ流れます。

### ポスターを差し替える
`assets/img/poster.jpg` を上書き → `python3 tools/optimize_images.py` を実行（表示用の poster-1800.webp / poster-1200.webp と OGP画像をまとめて作り直します）。

### ファビコン
X のアイコン（MKPロゴ）から作っています：`favicon-32.png` / `icon-96.png` / `apple-touch-icon.png`。
変えるときは同じ名前・同じサイズで上書きしてください。

### 姫の紋章（emblem-*.png）
ヘッダー・フッター・テーマ映像の読み込み中・About の上部に使っています。
サイトからSVGを直接ダウンロードされないよう、公開しているのはPNG（400×492・透過）だけです：
`assets/img/emblem-silver.png`（銀）/ `emblem-prism.png`（プリズム）/ `emblem-ink.png`（濃いグレー）。
元のSVG（黒1色のIllustrator書き出し）はリポジトリに置いていません。差し替えるときは同じ名前・同じサイズのPNGで上書きしてください。

---

## フォトギャラリー（部員の写真を載せる）

```
部員：upload.html で合言葉を入れて写真を投稿 ─→ Googleドライブ（写真）＋ スプレッドシート（情報）
                                                         │
お客さん：gallery.html ←────────────── 自動で一覧を読み込んで表示
```

- 投稿ページ（`upload.html`）はスマホ向け。合言葉 → 注意事項の確認 → 写真を選ぶ → 写っているキャラをタップでタグ付け → 名前・Xリンク（任意）→ 投稿
- 写真は送る前にスマホの中で **長い辺1800px・JPEG（1枚0.2〜0.6MBほど）** に自動で縮小され、位置情報などは消えます
- iPhone の **HEIC形式** もそのまま選べます（Safari 以外のブラウザでは `js/vendor/heic-to.js` で JPEG に変換。最初の1枚だけ数秒かかります）
- 「投稿済みの写真」タブ：自分の写真はタグ・クレジットの変更と削除、**他の人の写真は確認のうえ削除だけ**できます
  （「自分の写真」はその端末のブラウザで見分けています。別のスマホからは自分の写真でも変更できず、削除だけになります）
- `content.js` の `gallery.apiUrl` が空のあいだは **デモモード**（見本の写真が出て、投稿は自分の端末の中だけ。合言葉は `demo`）

### いまの設定（2026/10/16 に作成済み）

- Googleアカウント：417kota.music@gmail.com
- スプレッドシート：「MKP26 ギャラリー」（`photos` シートに1枚1行）
- Apps Script：「MKP26 Gallery API」（script.google.com の「マイプロジェクト」から開けます。スプレッドシートとは別のプロジェクトで、`SPREADSHEET_ID` でつないでいます）
- 写真の保存先：Googleドライブの「MKP26 Gallery Photos」フォルダ
- `content.js` の `gallery.apiUrl` 設定済み → サイトを公開すればそのまま動きます
- 合言葉は Apps Script の `PASSWORD` の行にあります（変えたら「新バージョン」でデプロイし直し）

### 最初の設定（作り直すとき用・10分くらい）

> サークル用の **個人のGoogleアカウント**（@gmail.com）で作るのがおすすめです。
> 大学のアカウントだと「リンクを知っている全員に公開」ができず、写真が表示されないことがあります。

1. Googleドライブで **新しいスプレッドシート** を作る（名前は例えば「MKP26 ギャラリー」）
2. メニューの **拡張機能 → Apps Script** を開く
3. 最初から入っている `function myFunction() {}` を消して、`gas/Code.gs` の中身をまるごと貼り付ける
4. 上の方の `PASSWORD: "ここに合言葉を書く"` を、部員用の合言葉に書き換えて 💾 保存
5. 上の関数の選択欄で **`setup`** を選んで **▶ 実行**
   → 「承認が必要です」→ 自分のアカウントを選ぶ →「このアプリは Google で確認されていません」と出たら
   **詳細 → （安全ではないページ）に移動 → 許可**（自分で作ったスクリプトなので大丈夫です）
   → 下の実行ログに「準備OK」と出れば成功。スプレッドシートに `photos` シート、ドライブに写真用フォルダができます
6. 右上の **デプロイ → 新しいデプロイ** → 歯車 ⚙ で **ウェブアプリ** を選ぶ
   - 次のユーザーとして実行：**自分**
   - アクセスできるユーザー：**全員**
   → デプロイ → 表示された **ウェブアプリのURL**（`https://script.google.com/macros/s/……/exec`）をコピー
7. `data/content.js` の `gallery.apiUrl: ""` の `""` の中にそのURLを貼る → サイトを公開し直す
8. `upload.html` を開いて合言葉で入り、試しに1枚投稿 → `gallery.html` に出ればOK
9. 部員に **`https://（サイトのURL）/upload.html` と合言葉** を共有

### 運用メモ

| やりたいこと | やり方 |
|---|---|
| 合言葉を変える | Apps Script の `PASSWORD` を書き換え → **デプロイ → デプロイを管理 → ✏️ → バージョン「新バージョン」→ デプロイ**（URLは変わりません） |
| 写真を一時的に隠す | スプレッドシートの `status` を `hidden` にする（`public` に戻すと再表示） |
| 消した写真を戻す | ドライブのゴミ箱から写真を復元し、シートの `status` を `public` に戻す（30日以内） |
| タグやクレジットを運営が直す | スプレッドシートの `tags`（カンマ区切り）・`credit`・`xUrl` を直接書き換える（反映まで最大2分） |
| キャラ（タグ）を増やす | `content.js` の `gallery.tags` に名前を足す |
| 公演前はメニューに出さない | `content.js` の `gallery.showInMenu: false`（ページ自体は開けます） |
| ネタバレ注意・確認事項の文を変える | `content.js` の `gallery.spoiler` / `gallery.terms` |

- `Code.gs` を書き換えたときは、毎回「新バージョン」でデプロイし直さないと反映されません
- 写真の表示には Google ドライブの画像配信を使っています（無料。ドライブの容量は 15GB まで＝圧縮後の写真なら数万枚）
- 投稿・削除にかかる時間は1枚あたり数秒です（Googleのサーバー側の処理のため）

---

## 手元で確認する

フォルダで次を実行して http://localhost:8000 を開きます（VS Code の Live Server でもOK）。
```
python3 -m http.server 8000
```

## 公開する

- **GitHub Pages**: このフォルダの中身を push → Settings → Pages → Branch を main に
- **Netlify / Cloudflare Pages**: 管理画面にフォルダをドラッグ&ドロップ
- 動画が合計30MBほどあるので、どのサービスでも問題なく置けます（GitHubは1ファイル100MBまで）

## メモ

- デザインはポスターのトンマナ（夜の庭・祈りの光・プリズム・銀の額縁・羊皮紙）と姫の紋章に合わせています
- フォント: IM Fell English（英字見出し）/ しっぽり明朝 B1（物語・見出し）/ Zen Kaku Gothic New（本文）
- 動きを減らす設定（OSの「視差効果を減らす」）では、アニメーションとキャラ動画の自動再生を止めます

