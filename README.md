# 非属人YouTube作成ツール（Tool1・Tool2）

**公開URL:** https://youtube-channel-design.vercel.app

| ステップ | 場所 | 機能 |
|---------|------|------|
| **Tool1** | Web | 参考チャンネルURL → チャンネル設計書 |
| **Tool2** | Web | 自チャンネルURL → 競合リサーチ → 台本 |
| **動画化** | **PC（ZIP）** | 台本 → フリー素材＋字幕＋BGM → 1080p MP4 |

## 動画化（PC用 ZIP）

Tool2 で出した台本を、お手元の PC で本番 MP4 にします。

**ダウンロード:** https://github.com/kazu00001-stack/youtube-narration-video/releases/download/v1.0.0/youtube-narration-video.zip

1. ZIP を解凍 → 初回セットアップ
2. `settings.json` に API キー（音声 API・Pexels）を設定
3. 台本を `台本.md` に貼り付け → `python3 動画生成.py --project サンプル`

## Tool1 使い方

1. Gemini APIキーを入力 … [Google AI Studio](https://aistudio.google.com/apikey)
2. 参考チャンネルURL（TTP元）を入力
3. **チャンネル設計書を生成** → コピー or Markdown 保存

## Tool2 使い方

1. Tool1 で設計書を作成し、YouTube でチャンネル開設
2. 自チャンネルURL ＋ 任意で Tool1 設計書を貼り付け
3. **競合リサーチ＋台本を生成**（3段階・1〜2分）
4. 台本を Markdown 保存 → PC 用 ZIP ツールへ

## ローカル確認

```bash
cd "1000.ツール/非属人YouTube-Tool1"
npx vercel dev
```

## 技術構成

| ファイル | 役割 |
|---------|------|
| `index.html` | UI（Tool1・Tool2） |
| `app-tool1.js` / `app-tool2.js` | 各ツール |
| `api/generate.js` | Gemini API プロキシ |

- APIキーは **ブラウザ localStorage のみ**（サーバー非保存）
