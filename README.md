# 非属人YouTube作成ツール（Tool1・Tool2）

**公開URL:** https://youtube-channel-design.vercel.app

| Tool | 機能 |
|------|------|
| **Tool1** | 参考チャンネルURL → チャンネル設計書 |
| **Tool2** | 自チャンネルURL → 競合リサーチ → 台本 |
| **Tool3** | 台本 → サムネPNG + ナレーション音声 + MP4（※解説・朗読型に最適） |

## Tool3 使い方

1. **Tool3 動画**タブを開く
2. Tool2の台本を貼り付け（短尺〜2,000字推奨）
3. **MP4＋サムネを生成**
4. サムネPNG / MP4 / 音声WAV をダウンロード

技術: Gemini TTS（音声）+ Canvas（サムネ）+ ffmpeg.wasm（ブラウザ内MP4合成）

1. Tool1で設計書を作成し、YouTubeでチャンネル開設
2. **Tool2**タブを開く
3. 自チャンネルURL ＋ 任意でTool1設計書を貼り付け
4. **競合リサーチ＋台本を生成**（3段階・1〜2分）

出力: 競合分析表、タイトル案、フル台本、投稿タグ、Tool3用サムネ文案

## 使い方（3ステップ）

1. **Gemini APIキー**（無料）を入力 … [Google AI Studio](https://aistudio.google.com/apikey)
2. **参考チャンネルURL**（TTP元）を入力 … 概要欄や動画タイトルの貼り付けがあると精度UP
3. **生成** → 設計書をコピー or Markdown保存 → YouTube Studioに反映

※ YouTubeのチャンネル開設操作自体はご自身のアカウントで行ってください。

## ローカル確認

```bash
cd "1000.ツール/非属人YouTube-Tool1"
npx vercel dev
```

`http://localhost:3000` で開く（`/api/generate` が動くため **静的ファイル直開きでは不可**）。

## Vercel 公開

**公開URL:** https://youtube-channel-design.vercel.app

再デプロイ: Vercel ダッシュボードから `kazu00001-stack/youtube-channel-design` を Deploy

## GitHub Pages について

Gemini API プロキシ（`api/generate.js`）が必要なため、**Vercel 推奨**。GitHub Pages のみでは API が動きません。

## 技術構成

| ファイル | 役割 |
|---------|------|
| `index.html` | UI |
| `app.js` | 入力保存・2段階生成 |
| `style.css` | スタイル |
| `api/generate.js` | Gemini API プロキシ（Vercel Serverless） |

- APIキーは **ブラウザ localStorage のみ**（サーバー非保存）
- 生成時のみ `/api/generate` 経由で Gemini へ送信

## 出力内容

- チャンネル名案 ×3
- ハンドル案
- 概要欄テンプレ（コピペ用）
- キーワード・タイトルの型・再生リスト案
- 差別化ポイント
- YouTube開設チェックリスト

## 関連

- 仕様正本: `3.自社案件/AYP_YouTube実践/非属人YouTube作成ツール_3ツール仕様.md`
- 出力フォーマット参考: `3.自社案件/AYP_YouTube実践/深層都市伝説ファイル/チャンネル作成_設定シート.md`
