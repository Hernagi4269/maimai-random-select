# アーキテクチャ

## 構成

```text
セガ公式 楽曲JSON
        │ ビルド時に取得（認証不要）
        ▼
scripts/lib/official-data.mjs
        │ 画像を除外・統一スキーマへ正規化
        ├──────────────┐
        ▼              ▼
GitHub Pages       定期抽選Action
静的Webアプリ       ├─ config/schedules.json
├─ 手動抽選         ├─ data/automated-history.json
├─ localStorage履歴 └─ Discord Webhook
└─ 自動履歴の閲覧
```

## 責務の分離

- `scripts/lib/official-data.mjs`: 外部データを内部スキーマへ変換するアダプター。
- `src/core/`: データ取得元や画面に依存しないフィルター、抽選、履歴、スケジュール、Discord整形。
- `src/web/`: iPhone優先の表示とブラウザー内保存。
- `scripts/run-scheduled.mjs`: 週/月条件を読み、抽選・履歴更新・通知を実行。
- `config/schedules.json`: 週課題と月課題の独立した条件。
- `.github/workflows/`: テスト、Pages配信、定期抽選。

データ取得元を変える場合は、新しいアダプターから現在の `schemaVersion: 1` 形式を返せば、抽選コアとUIは変更しない。

## 履歴

手動履歴はブラウザーの `localStorage` に保存する。端末内にだけ残るため、GitHub認証情報をiPhoneへ置かずに済む。UIからJSONを書き出し・読み込みできる。

週/月履歴は GitHub Actions が `data/automated-history.json` へ追記し、botコミットする。次のPagesデプロイでWeb画面からも見える。

手動履歴を複数端末へ自動同期するには書き込み可能なバックエンドが必要になる。現構成ではセキュリティと無料運用を優先し、明示的なエクスポート／インポートに留める。

## 重複防止

- 同じ曲、または同じ譜面を単位として選べる。
- 直近N回と過去N日の和集合を除外する。
- 除外後だけ0件になった場合、設定で許可されていれば重複除外だけを解除する。
- 難易度、Lv、STD/DX、ジャンル、バージョンは一切変更しない。
- 緩和した場合は結果画面と履歴に記録する。

## セキュリティ

- Discord WebhookはGitHub Actions secretまたは一時的な環境変数だけで渡す。
- `allowed_mentions.parse` を空にして、曲名などから意図しないメンションを発生させない。
- maimai でらっくすNETへログインしない。Cookie・セッションを扱わない。
- ユーザー入力した履歴は `textContent` で描画し、HTMLとして挿入しない。
- 依存パッケージは0件。Node.js標準機能だけでビルド・テストする。

## 配信上の制限

GitHub Pagesは静的ホスティングである。手動履歴の中央DB同期や、Web画面からのWebhook送信は行わない。Webhook URLをブラウザーへ配ると漏えいするため、Discord投稿はActions内だけで行う。

GitHub Actionsのcronは混雑時に遅延する場合がある。またWebhook送信成功後、履歴コミットだけが失敗すると、手動再実行時に重複投稿の可能性がある。Discord Webhookには一般的な冪等キー機能がないため、Embedへ課題IDを表示して識別できるようにしている。

