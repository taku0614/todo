// ===== チームToDo 設定ファイル =====
// Firebaseコンソール「プロジェクトの設定 → マイアプリ（</>）」に表示される firebaseConfig を
// 下の firebase: { ... } にそのまま貼り付けてください。
// apiKey が「ここに…」のままだと、端末内だけで動くデモモードになります。
window.TODO_CONFIG = {
  firebase: {
    apiKey: "ここに貼り付け",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  },
  // プッシュ通知用の公開鍵（変更不要）。対になる秘密鍵は GitHub の Secrets に登録します。
  vapidPublicKey: "BMrUHaTd6YFOJUdDn8MVY2lIQWObszCduFtu1yKN25CoPldJNtXINVqMUVbqbenjc-wl5LfIgHfzLFfphIc0DFs"
};
