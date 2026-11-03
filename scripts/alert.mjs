// 期限超過タスクのプッシュ通知（GitHub Actions から5分ごとに実行）
// 当日期限・未完了・期限時刻を過ぎたタスクを、担当者と確認者の端末に通知する。
// 完了するまで REALERT_MIN 分（既定30分）ごとに再通知する。
import admin from 'firebase-admin';
import webpush from 'web-push';

const env = k => { const v = process.env[k]; if (!v) { console.error(`Secret ${k} が未設定です`); process.exit(1); } return v; };
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(env('FIREBASE_SERVICE_ACCOUNT'))) });
// 貼り付け時の余分な空白・改行・説明文を除去し、鍵の文字列だけを取り出す
const key = (k, min) => { const m = env(k).match(new RegExp(`[A-Za-z0-9_-]{${min},}`, 'g')); if (!m) { console.error(`${k} の形式が正しくありません`); process.exit(1); } return m[m.length - 1]; };
webpush.setVapidDetails('mailto:' + (process.env.VAPID_SUBJECT || 'todo@example.com'), key('VAPID_PUBLIC', 80), key('VAPID_PRIVATE', 40));
const db = admin.firestore();

const INTERVAL = (Number(process.env.REALERT_MIN) || 30) * 60e3;

async function tick() {
const now = Date.now();
const today = new Date(now + 9 * 3600e3).toISOString().slice(0, 10); // 日本時間の今日
let sent = 0;
const teams = await db.collection('teams').listDocuments();
for (const tref of teams) {
  // alertAt（次に通知すべき時刻）が来たタスクだけを読む → 読み取り回数を最小化（無料枠対策）
  const snap = await tref.collection('tasks').where('alertAt', '<=', now).get();
  if (snap.empty) continue;
  const due = [];
  for (const d of snap.docs) {
    const t = d.data();
    if (t.done || t.date !== today) { await d.ref.update({ alertAt: 9999999999999 }); continue; } // 完了済み・前日以前は通知対象外
    due.push(d);
  }
  if (!due.length) continue;
  const subs = (await tref.collection('subs').get()).docs;
  const overdueBy = name => due.filter(d => { const t = d.data(); return t.assignee === name || t.checker === name; }).length;

  for (const d of due) {
    const t = d.data();
    let targets = subs.filter(s => [t.assignee, t.checker].includes(s.data().member));
    if (!targets.length) targets = subs; // 担当・確認者が通知未登録ならチーム全員へ
    const late = Math.round((now - t.dueAt) / 60e3);
    await Promise.all(targets.map(s => {
      const sd = s.data();
      const payload = JSON.stringify({
        title: `⚠ 期限超過：${t.title}`,
        body: `${t.time}期限（${late}分超過）／担当 ${t.assignee}・確認 ${t.checker}`,
        tag: 'task-' + d.id, url: './?t=' + tref.id, count: overdueBy(sd.member)
      });
      return webpush.sendNotification({ endpoint: sd.endpoint, keys: sd.keys }, payload, { TTL: 3600, urgency: 'high' })
        .then(() => { sent++; })
        .catch(e => {
          if (e.statusCode === 404 || e.statusCode === 410) return s.ref.delete(); // 無効になった端末は削除
          console.error('push失敗', e.statusCode, e.body);
        });
    }));
    await d.ref.update({ lastAlertAt: now, alertAt: now + INTERVAL, alertCount: admin.firestore.FieldValue.increment(1) });
  }
}
// ===== 当日朝のお知らせ：前もって登録したタスクの期限日 8:00 に軽く通知 =====
for (const tref of teams) {
  const snap = await tref.collection('tasks').where('noticeAt', '<=', now).get();
  if (snap.empty) continue;
  const subs = (await tref.collection('subs').get()).docs;
  for (const d of snap.docs) {
    const t = d.data();
    if (!t.done && !t.noAlert && t.date === today && t.dueAt > now) {
      const targets = subs.filter(s => [t.assignee, t.checker].includes(s.data().member));
      const payload = JSON.stringify({ title: `📅 本日期限：${t.title}`, body: `${t.time}まで／担当 ${t.assignee}・確認 ${t.checker}`, tag: 'notice-' + d.id, url: './?t=' + tref.id, count: 1 });
      await Promise.all(targets.map(s => { const sd = s.data();
        return webpush.sendNotification({ endpoint: sd.endpoint, keys: sd.keys }, payload, { TTL: 3600 * 6, urgency: 'normal' })
          .then(() => { sent++; })
          .catch(e => { if (e.statusCode === 404 || e.statusCode === 410) return s.ref.delete(); console.error('push失敗', e.statusCode, e.body); });
      }));
    }
    await d.ref.update({ noticeAt: 9999999999999 });
  }
}

// ===== 完了通知：担当者が完了したら確認者へ =====
for (const tref of teams) {
  const snap = await tref.collection('tasks').where('doneNotified', '==', false).get();
  const list = snap.docs.filter(d => { const t = d.data(); return t.done && !t.checked; });
  if (!list.length) { await Promise.all(snap.docs.map(d => d.ref.update({ doneNotified: true }))); continue; }
  const subs = (await tref.collection('subs').get()).docs;
  for (const d of snap.docs) {
    const t = d.data();
    if (t.done && !t.checked) {
      const targets = subs.filter(s => s.data().member === t.checker);
      const payload = JSON.stringify({
        title: `✅ 確認依頼：${t.title}`,
        body: `${t.doneBy || '担当者'}さんが完了しました。確認をお願いします`,
        tag: 'done-' + d.id, url: './?t=' + tref.id + '&f=check', count: 1
      });
      await Promise.all(targets.map(s => { const sd = s.data();
        return webpush.sendNotification({ endpoint: sd.endpoint, keys: sd.keys }, payload, { TTL: 86400, urgency: 'normal' })
          .then(() => { sent++; })
          .catch(e => { if (e.statusCode === 404 || e.statusCode === 410) return s.ref.delete(); console.error('push失敗', e.statusCode, e.body); });
      }));
    }
    await d.ref.update({ doneNotified: true });
  }
}
console.log(`${today} 通知送信 ${sent} 件`);
}

// 1回の起動で LOOP_MIN 分間、1分ごとに見回る（GitHubの定期実行は最短5分のため）
const LOOP_MIN = Number(process.env.LOOP_MIN) || 1;
const end = Date.now() + LOOP_MIN * 60e3;
do {
  const t0 = Date.now();
  try { await tick(); } catch (e) { console.error('見回りエラー', e.message); }
  const wait = 60e3 - (Date.now() - t0);
  if (Date.now() + wait >= end) break;
  await new Promise(r => setTimeout(r, Math.max(wait, 1000)));
} while (true);
process.exit(0);
