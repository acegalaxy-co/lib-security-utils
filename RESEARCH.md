# lib-security-utils research — nguồn, phát hiện, hướng cải tiến

Snapshot 2026-09-24. Cách research: đọc git history của repo gốc trên GitHub
(`acegalaxy-co/ace_commons-security-utils-nodejs`, sắp rename thành
`lib-security-utils`), README/CHANGELOG của repo đó, code nguồn ở Nexus
(`commons/db-gateway/lib` + `commons/ott-gateway/lib` là bản inline/fork của
cùng 3 primitive), rule/README liên quan trong Nexus, và web prior-art cho
từng primitive. Các fact về version/commit dưới đây là snapshot tại thời điểm
research — repo gốc có thể đã đổi tiếp sau ngày này.

## Nguồn research

**Nội bộ:**
- Repo GH gốc `acegalaxy-co/ace_commons-security-utils-nodejs`, commit đầu
  `8df8686` ("chore: initial commit — split from framework monorepo"), tag
  gần nhất `v0.2.0` (release "extract vault-loader to `@acegalaxy/notion-vault`",
  commit `75404bf`). README + CHANGELOG.md tại HEAD của repo đó.
- Nexus `commons/db-gateway/lib/{audit-log,caller-validator,rate-limit}` +
  `commons/ott-gateway/lib/{audit-log,rate-limit}` — bản mirror/inline của
  `@acegalaxy/security-utils@0.1.2`/`@0.2.0` (README 2 gateway ghi rõ
  "Migrated from ... + inlined `@acegalaxy/security-utils@0.x.x`. No npm
  dependency."). Git log riêng 2 path này chỉ có 1 commit `785aff46` ("chore:
  squash history (force-snapshot)") — lịch sử chi tiết đã bị squash, không
  truy được commit gốc trong Nexus.
- `commons/db-gateway/README.md` (sơ đồ 5-layer default-deny gateway),
  `commons/ott-gateway/README.md` (sơ đồ 5-layer inbound message gateway).
  Không tìm thấy rule/memory Nexus nào nhắc trực tiếp
  `security-utils`/`caller-validator`/`sliding-window`/`replay-guard`
  (grep `.claude/rules`, `.claude/memory`, auto-memory MEMORY.md — 0 kết
  quả); rule gần nhất liên quan là `system-ai-gateway.md` (pattern audit-log
  path phải trỏ ngoài `node_modules` để sống sót `npm install`).
- Plan file `.claude/state/plan-commons-libs.md` — quyết định rename-in-place
  toàn bộ `@acegalaxy/*` → `@acegalaxy/lib-*`, private git-dep, giữ API/env
  var không đổi.

**Ngoài (web, đã tra cứu qua search, không fetch trực tiếp URL cụ thể — chỉ
tên nguồn, không bịa link):**
- `rate-limiter-flexible` (npm package) — limiter đa thuật toán (points-based,
  multi-window, progressive penalty, fallback in-memory khi Redis down).
- `sliding-window-rate-limiter` (npm package) — sliding-window thuần, backend
  Redis phiên bản mới hoặc in-memory, Node >=16.
- Advisory database công khai về `node-opcua` (replay-nonce-cache không TTL
  gây unbounded memory DoS) — dẫn chứng thực tế cho việc TTL trong
  replay-guard là bắt buộc, không phải optional.

## Đã tham khảo gì

### Bài toán gốc trong Nexus — vì sao tách lib

`db-gateway` và `ott-gateway` là 2 gateway độc lập nhưng cùng cần đúng 3 khối
hạ tầng bảo mật giống hệt nhau: append-only audit log (L5), caller/identity
validation default-deny (L2), và rate-limit + replay-guard (L4). Ban đầu mỗi
gateway tự inline một bản copy của `@acegalaxy/security-utils` (db-gateway
pin `0.2.0`, ott-gateway pin `0.1.2` — README ott-gateway còn ghi rõ thư mục
`lib/` là "INLINED from `@acegalaxy/security-utils@0.1.2`"). Hệ quả: 2 bản
copy lệch version, sửa bug ở primitive phải patch tay ở cả hai chỗ, không có
nơi test riêng cho 3 khối logic này. `audit-log` và `rate-limit` giữa 2 gateway
byte-identical (xác nhận trong CHANGELOG của `lib-security-utils` package.json
0.3.0), nên gộp về 1 lib dùng chung qua git-dependency là hợp lý thay vì tiếp
tục fork.

### Ý tưởng thiết kế chính

- **Append-only audit log** (`audit-log/index.ts`) — `createAuditLogger`
  ghi JSONL, không throw khi write fail (chỉ log ra stderr) để audit logging
  không bao giờ làm sập main call flow — đúng nguyên tắc "observability
  không được là single point of failure" của cả 2 gateway gốc (L5 trong sơ đồ
  db-gateway và ott-gateway).
- **Caller-validator default-deny** (`caller-validator/index.ts`) —
  `createCallerValidator` resolve `{service, scope, roles}`; thiếu object,
  thiếu `service`, hoặc thiếu `scope` → trả `null` (deny), field lạ bị drop
  trừ khi whitelist qua `extraFields`. Đây chính là pattern L2 trong sơ đồ
  5-layer của cả `db-gateway` (Identity resolver) và `ott-gateway` (map
  platform principal → internal identity + role).
- **Sliding-window rate-limit + replay guard** (`rate-limit/index.ts`) —
  `createSlidingWindow` (windowMs/maxRequests/keyFn/extraChecks pluggable) +
  `createReplayGuard` (TTL-based, `seen(id)` true = duplicate trong TTL và tự
  refresh timestamp). Đúng layer L4 của cả 2 gateway: `db-gateway` dùng cho
  "how fast may they call", `ott-gateway` dùng thêm replay-guard để dedup
  message-id chống flood/forward lặp.

### Prior art / so sánh thư viện có sẵn

- `rate-limiter-flexible` mạnh hơn nhiều (đa thuật toán, multi-backend Redis/
  Memcached/Mongo, progressive penalty) nhưng nặng dependency và thiết kế cho
  multi-instance/distributed rate-limit — 2 gateway Nexus chạy single-process,
  in-memory là đủ, không cần Redis client kéo theo. Không dùng.
- `sliding-window-rate-limiter` gần sát nhất về scope (sliding-window thuần,
  hỗ trợ in-memory) nhưng vẫn là dependency ngoài phải theo dõi CVE/breaking
  change riêng, trong khi lib nội bộ chỉ ~vài chục dòng, đã bám sát đúng nhu
  cầu 2 gateway (keyFn + extraChecks pluggable để nhét policy riêng). Không
  dùng, giữ implementation tự viết.
- Replay-guard: prior art phổ biến là nonce + TTL cache, cảnh báo thực tế là
  cache không TTL sẽ phình bộ nhớ vô hạn (ví dụ lỗ hổng thật trong
  `node-opcua` — biến global track nonce đã dùng không bao giờ evict).
  `createReplayGuard` ở đây đã có TTL từ đầu, đúng khuyến nghị chuẩn, không
  phải gap cần vá. Không cần thư viện ngoài cho một map TTL đơn giản.

## Hướng cải tiến

**Đã áp dụng:**
- `0.3.0` (2026-09-24) — merge 3 primitive từ Nexus
  `commons/db-gateway/lib/{audit-log,caller-validator,rate-limit}` (audit-log
  và rate-limit byte-identical với `commons/ott-gateway/lib/`) thành 1 package
  chuẩn hoá, thay vì tiếp tục giữ 2 bản inline lệch version trong 2 gateway.
- Rename `@acegalaxy/security-utils` → `@acegalaxy/lib-security-utils`,
  `private: true`, chuyển kênh phân phối từ npm public sang private
  git-dependency (`github:acegalaxy-co/lib-security-utils#v0.3.0`) — theo
  quyết định rename-in-place khoá trong `plan-commons-libs.md` (mọi lib nội
  bộ đổi prefix `lib-` + git-dep riêng, không còn publish npm public).
- Loại bỏ `vault-loader` khỏi scope (đã tách thành `@acegalaxy/notion-vault`
  ở `v0.2.0` của repo gốc, giữ nguyên quyết định đó khi merge lên `0.3.0`).

**Deferred / chưa implement:**
- Chưa có test cho `caller-validator` riêng lẻ trong lib mới ngoài smoke qua
  `npm test` chung — nên thêm case `extraFields` + object malformed edge case
  rõ ràng hơn.
- Rate-limit hiện in-memory thuần, không có backend chia sẻ giữa nhiều
  process/instance — nếu Nexus scale ra multi-instance, `createSlidingWindow`
  sẽ cần một biến thể có backend chia sẻ (tham khảo API shape của
  `rate-limiter-flexible`/`sliding-window-rate-limiter` thay vì tự thiết kế
  lại từ đầu).
- CI của repo (`.github/workflows/ci.yml`) build/test bằng git-dep lồng
  nhau chưa được xác nhận hoạt động với private repo (cần SSH/deploy key) —
  ghi trong plan file là "check ALL renamed repos", chưa verify riêng cho
  lib này.
- Không có changelog machine-readable (`CHANGELOG.md`) tại repo mới — hiện
  changelog chỉ nằm trong section "Changelog" của README.
