# maimai 課題曲セレクター

現在の「maimai でらっくす」公式楽曲一覧を基礎に、指定条件へ一致する譜面から課題曲を1つ抽選する独立システムです。iPhoneでの手動抽選、重複防止、週課題・月課題、Discord Webhook通知、履歴保存を、PC常時起動なしで運用できます。

非公式ファンツールであり、株式会社セガとは関係ありません。

## 実装済みの機能

- ADVANCED / EXPERT / MASTER / Re:MASTER の複数選択
- 表示Lvの範囲指定（例: `13`～`14+`）
- STD / DX の個別・両方指定
- ジャンル、追加バージョン絞り込み
- 譜面単位のランダム抽選と再抽選
- クリア、SSS、SSS+、FC、FC+、AP、AP+、DX SCORE ★5、理論値、記録更新の目標付与
- 課題確定後の端末内履歴
- 手動 / 週 / 月の履歴フィルター
- 履歴JSONの書き出し・読み込み
- 同曲または同譜面を、直近N回・過去N日から除外
- 重複除外だけで候補0件になった場合の安全な緩和
- 週課題と月課題の別条件・別履歴
- Discord Embed通知
- GitHub Actionsによる毎日の楽曲データ更新、定期抽選、Pages配信
- Node.js標準テストによるデータ変換・条件・履歴・通知の検証

## 使用技術

- HTML / CSS / JavaScript（フレームワークなし）
- Node.js 20以上（ビルド、公式データ変換、定期抽選、テスト）
- GitHub Pages（静的Webアプリ）
- GitHub Actions（データ更新、週/月抽選、Discord、デプロイ）
- `localStorage`（iPhone内の手動履歴・設定）

実行時依存パッケージはありません。小規模ツールとして、更新箇所と障害点を少なくしています。

## 楽曲データ

セガ公式の[楽曲リスト](https://maimai.sega.jp/song/)が読み込む[公開JSON](https://maimai.sega.jp/data/maimai_songs.json)を、ビルド時に取得します。リポジトリには公式の全楽曲データやジャケット画像をコミットしません。

取得する項目は曲名、アーティスト、ジャンル、追加バージョン、表示Lv、STD/DX、難易度です。公式JSONに内部Lvと公式IDはないため、内部Lvは `null`、IDは本システム内の安定IDです。

調査結果、代替案、不採用理由、すぎめーら氏のツールの確認内容は [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) に記録しています。設計は [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) を参照してください。

## ローカル実行

必要なものは Node.js 20以上です。

```powershell
npm install
npm run data:update
npm run dev
```

表示された `http://127.0.0.1:4173` をブラウザーで開きます。`npm run data:update` は公式サイトへアクセスし、`.cache/songs.json` を作ります。このファイルはGit管理されません。

テストだけを実行する場合:

```powershell
npm test
```

配信用の `dist/` を作る場合:

```powershell
npm run build
```

定期抽選を保存・送信せずに試す場合:

```powershell
npm run scheduled -- --mode=weekly --dry-run
```

## Webアプリの使い方

1. 難易度を1つ以上選びます。
2. 表示Lvの下限と上限を選びます。
3. STD / DX を選びます。
4. 達成目標を選びます。
5. 必要なら「ジャンル・追加バージョンで絞り込む」を開きます。
6. 「課題曲を抽選」を押します。
7. 結果が気に入らなければ「もう一度」、採用するなら「この課題に決定」を押します。

確定するまで履歴には保存されません。設定ボタンから、同じ曲・譜面を避ける回数と日数を変更できます。

## 手動履歴

手動履歴と除外設定は、使用中のブラウザー内に保存されます。別iPhoneやPCとは自動同期されません。

- 機種変更前: 「履歴を書き出す」でJSONを保存
- 新端末: 「履歴を読み込む」でそのJSONを選択
- 「手動履歴を消去」はこの端末の手動履歴だけを消し、Actionsが作った週/月履歴は消しません

## 週課題・月課題の設定

条件は [`config/schedules.json`](config/schedules.json) にあります。

```json
{
  "weekly": {
    "weekDay": 1,
    "achievement": "AP",
    "filters": {
      "difficulties": ["MASTER"],
      "levelMin": "13+",
      "levelMax": "14+",
      "types": ["STD", "DX"]
    }
  }
}
```

- `weekDay`: 日曜 `0`、月曜 `1`、…、土曜 `6`
- `dayOfMonth`: 月課題を作る日（既定は `1`）
- `achievement`: 表示・保存する目標
- `difficulties`: `ADVANCED`, `EXPERT`, `MASTER`, `Re:MASTER`
- `levelMin` / `levelMax`: `1`～`15`、`7+`～`14+`
- `types`: `STD`, `DX`
- `genres` / `versions`: 空配列で全対象、文字列を入れると限定
- `exclusion.unit`: `song` または `chart`
- `recentCount` / `days`: 重複除外範囲

定期Actionは毎日06:05ごろ（日本時間）に起動し、設定上の曜日・日だけ抽選します。GitHub Actionsの混雑で遅れることがあります。

実行時刻自体を変える場合は [`.github/workflows/scheduled-challenge.yml`](.github/workflows/scheduled-challenge.yml) のcronをUTCで変更してください。日本時間から9時間引いた時刻がUTCです。

### GitHub画面から手動で週/月抽選する

1. GitHubでリポジトリを開きます。
2. 上部の「Actions」を押します。
3. 左の「Draw scheduled challenge」を押します。
4. 右側の「Run workflow」を押します。
5. `weekly` または `monthly` を選びます。
6. Discordへ送るかを選び、緑の「Run workflow」を押します。

同じ週・月の課題IDが既に履歴にあれば、重複作成しません。

## Discord Webhook設定

### Webhook URLを作る

1. Discordで投稿先サーバーを開きます。
2. チャンネル名の歯車を押し、「連携サービス」を開きます。
3. 「ウェブフック」→「新しいウェブフック」を押します。
4. 投稿先チャンネルを確認し、「ウェブフックURLをコピー」を押します。

URLをREADMEや設定ファイルへ貼らないでください。

### GitHub Secretへ登録する

1. GitHubで `Hernagi4269/maimai-random-select` を開きます。
2. 「Settings」を押します。見えない場合はリポジトリ管理権限を確認します。
3. 左の「Secrets and variables」→「Actions」を押します。
4. 「New repository secret」を押します。
5. Nameへ `DISCORD_WEBHOOK_URL` と入力します。
6. SecretへコピーしたWebhook URLを貼ります。
7. 「Add secret」を押します。

Secret未設定でも抽選と履歴保存は動きますが、Discord投稿はスキップされます。

## GitHub Pagesの公開

1. GitHubでリポジトリの「Settings」を開きます。
2. 左の「Pages」を押します。
3. 「Build and deployment」のSourceを「GitHub Actions」にします。
4. 上部の「Actions」→「Deploy GitHub Pages」を開きます。
5. 「Run workflow」を押すか、`main` ブランチへpushします。
6. 緑のチェックが付いた実行を開き、`deploy` に表示されるURLを押します。

公開URLは通常、次の形式です。

<https://hernagi4269.github.io/maimai-random-select/>

リポジトリが非公開の場合、アカウントプランやPages設定により公開可否・URLが異なります。Actionsの `deploy` が返したURLを正として使用してください。

## 楽曲データの更新

Pagesワークフローが毎日05:30ごろ（日本時間）に公式JSONを再取得して再デプロイします。PCを起動する必要はありません。

今すぐ更新する場合:

1. GitHubの「Actions」を開きます。
2. 「Deploy GitHub Pages」を押します。
3. 「Run workflow」を押します。

公式JSONの取得に失敗した場合は、古い情報で更新成功にせずActionを失敗させます。前回のPagesはそのまま閲覧できます。

## GitHub Actions

- `CI`: push / pull requestごとに自動テスト
- `Deploy GitHub Pages`: push、毎日のデータ更新、手動実行でテスト・ビルド・公開
- `Draw scheduled challenge`: 毎朝の期日判定または手動実行で週/月抽選、Discord投稿、履歴コミット

定期抽選Actionが成功すると `workflow_run` でPagesデプロイが動き、Webの履歴にも反映されます。Actions botのコミットは通常のpushワークフローを自動起動しないため、この明示的な連携を使っています。ブランチ保護でActions botのpushを禁止している場合は、履歴保存が失敗するため設定変更が必要です。

## セキュリティ

- Discord Webhook URL、Cookie、パスワード、APIキーをコミットしないでください。
- maimai でらっくすNETへログインせず、認証情報も保存しません。
- `.env` と `.env.*` はGitから除外済みです。
- Webhookはブラウザーへ渡さず、GitHub Actions内だけで使用します。
- Discord通知ではユーザーメンションを無効化しています。
- GitHub ActionsのログへWebhook URLを出力しません。

Webhook URLが漏れた場合は、Discordのウェブフック設定からそのWebhookを削除し、新しく作り直してGitHub Secretも更新してください。

## 現在の制限

- 内部Lvは公式JSONにないため未対応です。
- 公式一覧にある解禁曲も候補です。個人の解禁状況は判定しません。
- 手動履歴は端末内保存で、自動クラウド同期はありません。
- GitHub Actionsのcronは指定時刻ぴったりを保証しません。
- Discord Webhookには厳密な一度だけ送信を保証する仕組みがなく、送信後の履歴pushだけが失敗した特殊ケースでは再投稿の可能性があります。
- 公式JSONの構造が変わるとデータ変換が失敗します。テストとAction失敗で検知します。
- 楽曲・譜面IDは公式IDではありません。

## 今後の拡張候補

- 利用条件が明確な内部Lvデータアダプター
- Cloudflare D1などを使った複数端末の手動履歴同期
- プレイヤーが解禁済みの曲だけを読み込む、ユーザー操作型のインポート
- 既存Analyzerとは直接結合せず、明示的エクスポートファイルを介した達成自動判定
- Web Pushによる課題通知

既存のmaimai Analyzer Botには依存せず、変更も行いません。

## ディレクトリ

```text
src/core/                  抽選・履歴・スケジュール・Discordの純粋ロジック
src/web/                   モバイル優先の静的Web UI
scripts/lib/official-data.mjs 公式JSONアダプター
scripts/run-scheduled.mjs  週/月抽選とWebhook
config/schedules.json      週/月の独立設定
data/automated-history.json Actionsが保存する履歴
test/                      自動テスト
.github/workflows/         CI・Pages・定期抽選
docs/                      調査と設計記録
```

## ライセンス

このリポジトリで新規作成したコードはMIT Licenseです。maimai、楽曲名、アーティスト名その他の第三者コンテンツの権利は各権利者に帰属します。MIT Licenseは第三者データや商標へ適用されません。

