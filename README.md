# 非属人YouTube チャンネル設計ツール（Tool1）

TTPしたいYouTubeチャンネルのURLから、**チャンネル設計書**（名前・概要欄・コンセプト・タグ等）をGeminiで生成するWebツール。

非属人YouTube作成ツール3本セットの **Tool1** です。

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

```bash
cd "1000.ツール/非属人YouTube-Tool1"
npx vercel --prod
```

または GitHub 連携:

1. このフォルダを public リポジトリ `youtube-channel-design` 等に push
2. [vercel.com](https://vercel.com) → Import Project → リポジトリ選択 → Deploy

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
