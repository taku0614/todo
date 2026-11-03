# チームToDo 公開手順（所要30〜40分・すべて無料）

構成：**GitHub Pages**（アプリ置き場）＋ **Firebase**（5人のリアルタイム共有）＋ **GitHub Actions**（5分ごとに期限超過をチェックしてプッシュ通知）

---

## 1. GitHubに置く（美歯抜歯と同じやり方）
1. GitHubで新しいリポジトリ `todo` を **Public** で作成
2. このフォルダの中身をすべてアップロード（`.github` フォルダも忘れずに）
   - Web画面で隠しフォルダが上げにくい場合は、Claudeに「リポジトリ作った」と伝えればpushします
3. Settings → Pages → Branch を `main` / `(root)` で保存
4. `https://taku0614.github.io/todo/` が開けばOK（この時点ではデモモード）

## 2. Firebase（共有データベース）
1. https://console.firebase.google.com で「プロジェクトを追加」（名前は `team-todo` など、アナリティクスはオフでOK）
2. 左メニュー **構築 → Authentication** → 始める → **匿名** を有効化
3. **構築 → Firestore Database** → データベースを作成 → ロケーション `asia-northeast1（東京）` → 本番環境モード
4. Firestore の **ルール** タブに `firestore.rules` の中身を貼って「公開」
5. **プロジェクトの設定（⚙）→ マイアプリ → </>（ウェブ）** でアプリ登録 → 表示された `firebaseConfig` の中身を `config.js` の `firebase: { … }` に貼り付けて、GitHubの `config.js` を更新

## 3. プッシュ通知（アプリを閉じていても通知）
1. Firebase **プロジェクトの設定 → サービスアカウント → 新しい秘密鍵を生成** → JSONファイルがダウンロードされる
2. GitHubのリポジトリ **Settings → Secrets and variables → Actions → New repository secret** で3つ登録

| Name | 値 |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | ダウンロードしたJSONファイルの中身を丸ごと |
| `VAPID_PUBLIC` | `todo-secrets-vapid-keys.txt`（別送） の公開鍵 |
| `VAPID_PRIVATE` | `todo-secrets-vapid-keys.txt`（別送） の秘密鍵 |

3. **Actions** タブ → 「期限超過アラート」→ Run workflow で手動実行し、緑✓になれば完了（以後5分ごとに自動実行）

> ⚠ サービスアカウントJSONと `VAPID_PRIVATE` は合鍵です。リポジトリにはアップロードせず、Secretsにだけ入れてください。

## 4. メンバーの使い始め
1. 船長がアプリを開き「新しくチームを作る」→ チーム名とメンバー5人を入力
2. ⚙設定 →「招待リンクを送る」でLINE等に共有
3. 各メンバー：リンクを開く →（iPhoneは）**共有 → ホーム画面に追加** → ホーム画面のアイコンから開き、**もう一度招待リンクを貼り付けて参加**（iPhoneはSafariとホーム画面アプリでデータが別のため）
4. ⚙設定で「あなたは誰？」を選び、**「この端末で通知を受け取る」** をタップして許可
5. 横長で使うため、画面の回転ロックはオフに

---

### 仕様メモ
- 期限時刻を過ぎた**当日タスク**は、アプリを開いた瞬間に**全画面が赤く点滅**（10分スヌーズ可）
- アプリを閉じている時は、担当者・確認者のスマホに**プッシュ通知**。完了するまで**30分ごとに再通知**（`alert.yml` の `REALERT_MIN` で変更可）
- GitHubの定期実行は混雑時に数分〜十数分遅れることがあります
- 繰り返しタスク（毎日／平日／毎週／毎月）は完了すると次回分が自動で作られます
- 完了したタスクは7日間表示され、それ以前は非表示（データは残ります）
