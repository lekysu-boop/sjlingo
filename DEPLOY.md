# DEPLOY.md — 처음부터 따라 하는 배포 가이드

> 대상: **클라우드 배포·GitHub 가 처음인 분.** 한 줄씩 그대로 따라 하면 됩니다.
> 결과: 인터넷 누구나 접속 가능한 주소(`https://내앱.vercel.app`)가 생깁니다.

---

## 왜 AWS 가 아니라 Vercel + Supabase 인가?

| 항목 | AWS 직접 구성 | **Vercel + Supabase (추천)** |
|---|---|---|
| 서버 설정 | EC2·로드밸런서·빌드 파이프라인 직접 | 없음 (자동) |
| 배포 방법 | 복잡한 CI/CD 구성 | **GitHub 에 push 하면 자동** |
| DB 운영 | RDS 설치·백업·튜닝 직접 | Supabase 가 대행 (관리형 PostgreSQL) |
| 비용 | 켜 두면 과금 | **무료 플랜으로 시작** |
| 러닝커브 | 높음 | 낮음 (이 프로젝트에 최적) |

> Classic ASP 를 FTP 로 올리던 것과 비교하면, Vercel 은 "코드를 GitHub 에 올리면
> 알아서 빌드·배포"되는 방식입니다. 서버(Tomcat 같은 WAS)를 직접 운영하지 않습니다.
> AWS 는 세밀한 제어가 필요한 대규모 서비스용이라, 지금 단계에선 과합니다.

전체 그림:
```
① 코드를 GitHub 에 올린다  →  ② Vercel 이 GitHub 를 보고 자동 배포  →  ③ Supabase(DB) 연결
```

---

## STEP 1. 준비물 (계정 3개 — 전부 무료, GitHub 로 가입 가능)

1. **GitHub** 계정 — https://github.com  (코드 저장소)
2. **Supabase** 계정 — https://supabase.com  (데이터베이스)
3. **Vercel** 계정 — https://vercel.com  (배포). 가입 시 "Continue with GitHub" 선택.

프로그램 설치: **Node.js LTS** (https://nodejs.org 에서 "LTS" 버튼) — 로컬 테스트용.
설치 확인: 터미널(명령 프롬프트)에서 `node -v` 입력 → 버전이 나오면 성공.

---

## STEP 2. Supabase 데이터베이스 만들기

1. Supabase 로그인 → **New project** 클릭.
2. 이름 아무거나, **Database Password** 는 메모해 두기, Region 은 `Northeast Asia (Seoul)`.
3. 프로젝트 생성까지 1~2분 기다립니다.
4. 왼쪽 메뉴 **SQL Editor** → `New query` → 이 프로젝트의 `supabase/schema.sql` 파일
   내용을 **전부 복사해 붙여넣고** → 오른쪽 아래 **Run** 클릭.
   → "Success" 가 뜨면 테이블이 모두 생성된 것입니다. (Oracle 에서 DDL 스크립트
   돌리는 것과 동일합니다.)
5. 왼쪽 **Project Settings**(톱니바퀴) → **API** 메뉴에서 아래 3개 값을 복사해 둡니다:
   - **Project URL**  →  나중에 `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** 키  →  `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** 키  →  `SUPABASE_SERVICE_ROLE_KEY`  *(비밀! 절대 공개 금지)*

---

## STEP 3. 내 컴퓨터에서 먼저 실행해 보기 (선택이지만 권장)

터미널에서 이 `nextjs` 폴더로 이동한 뒤:
```bash
npm install          # 라이브러리 내려받기 (mvn install 과 동일). 1~2분 소요.
```
그 다음 `.env.example` 파일을 복사해 `.env.local` 이라는 파일을 만들고, STEP 2에서
복사한 3개 값을 채웁니다:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...(anon 키)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...(service_role 키)
```
그리고 실행:
```bash
npm run dev
```
브라우저에서 **http://localhost:3000** 접속 → 앱이 뜨면 성공입니다.
(멈추려면 터미널에서 `Ctrl + C`)

> `.env.local` 은 접속 비밀번호가 든 파일이라 **깃허브에 올라가면 안 됩니다.**
> 이 프로젝트의 `.gitignore` 에 이미 제외 설정이 되어 있어 자동으로 안 올라갑니다.

---

## STEP 4. 코드를 GitHub 에 올리기

### 방법 A — GitHub Desktop (마우스로, 초보 추천)
1. https://desktop.github.com 에서 **GitHub Desktop** 설치 후 로그인.
2. `File → Add local repository` → 이 `nextjs` 폴더 선택.
   ("Git 저장소가 아니다"라고 하면 `create a repository` 클릭해서 초기화)
3. 왼쪽 아래 요약(Summary)에 아무 메시지나 쓰고 **Commit** (= 변경사항 저장 도장).
4. 위쪽 **Publish repository** 클릭 → 이름 정하고, **Keep this code private** 체크 →
   Publish. → GitHub 에 코드가 올라갑니다.
5. 이후 코드를 고칠 때마다: Commit → **Push origin** 만 누르면 됩니다.

### 방법 B — 명령어
```bash
git init
git add .
git commit -m "first commit"
# GitHub 웹에서 New repository 로 빈 저장소를 먼저 만든 뒤, 주소를 넣습니다:
git remote add origin https://github.com/내아이디/저장소이름.git
git branch -M main
git push -u origin main
```

> **용어**: commit = 변경사항을 저장하는 "도장"(형상관리의 체크인),
> push = 그 도장들을 GitHub(원격)로 업로드. pull = 원격 것을 내려받기.

---

## STEP 5. Vercel 로 배포하기 (여기서 인터넷 주소가 생깁니다)

1. Vercel 로그인 → **Add New… → Project**.
2. GitHub 저장소 목록에서 방금 올린 저장소의 **Import** 클릭.
   (안 보이면 "Adjust GitHub App Permissions" 로 접근 권한 부여)
3. 설정 화면에서:
   - **Framework Preset**: Next.js (보통 자동 인식)
   - **Root Directory**: 저장소에 `nextjs` 폴더째 올렸다면 `nextjs` 로 지정.
     (이 폴더만 올렸다면 그대로 두기)
   - **Environment Variables**: STEP 2의 3개 값을 그대로 추가:
     - `NEXT_PUBLIC_SUPABASE_URL`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
4. **Deploy** 클릭 → 1~3분 빌드 후 `https://저장소이름.vercel.app` 주소 완성! 🎉

이후로는 **GitHub 에 push 할 때마다 Vercel 이 자동으로 다시 배포**합니다.
(FTP 재업로드 없이, 저장소가 곧 배포 소스입니다.)

---

## STEP 6. 배포 후 점검·운영

- **Supabase** 대시보드 → **Table Editor** 에서 실제로 쌓이는 데이터를 눈으로 확인
  (Oracle 의 테이블 조회 툴처럼 쓸 수 있습니다).
- **Vercel** 대시보드 → **Deployments** 에서 배포 이력·빌드 로그 확인. 빌드가 실패하면
  여기 빨간 로그에 원인이 나옵니다(대개 환경변수 누락 또는 오타).
- **커스텀 도메인**: Vercel 프로젝트 → Settings → Domains 에서 내 도메인 연결 가능.

---

## 자주 겪는 문제 (트러블슈팅)

| 증상 | 원인 / 해결 |
|---|---|
| 화면은 뜨는데 데이터가 안 나옴 | 환경변수 3개 오타/누락. Vercel Settings→Environment Variables 재확인 후 **재배포** |
| `.env.local` 이 GitHub 에 올라감 | `.gitignore` 에 `.env*` 있는지 확인. 이미 올렸다면 키를 새로 발급 |
| 시트 불러오기 실패 | 구글 시트를 "링크가 있는 모든 사용자(뷰어)"로 공개했는지 확인 |
| 빌드 실패 | Vercel Deployments 의 빨간 로그 확인. 대개 타입 오류/환경변수 문제 |
| service_role 키 노출이 걱정됨 | 이 키는 서버(API)에서만 쓰이며 브라우저로 전송되지 않음. 단 GitHub·채팅에 붙여넣지 말 것 |

---

## 다음 단계 (선택)

- **이메일 로그인 추가**: `supabase/schema.sql` 하단 "옵션 B" 주석 + `LEARN.md` 8번 참고.
- **백업**: Supabase 는 유료 플랜에서 자동 백업. 무료도 SQL Editor 로 수동 덤프 가능.
- **모니터링**: Vercel Analytics(방문), Supabase Logs(쿼리) 무료 제공.

---

## 부록 A. CI/CD 는 어떻게 구성돼 있나?

이 프로젝트는 "검사(CI)"와 "배포(CD)"를 두 서비스가 나눠 맡습니다.

```
코드 push
   │
   ├─▶ GitHub Actions (CI)  : 자동으로 lint + 타입검사 + 빌드 성공 여부 확인
   │        └ 설정 파일: .github/workflows/ci.yml
   │
   └─▶ Vercel (CD)          : 자동으로 빌드해서 실서비스에 반영
            └ 설정 불필요 (저장소 연결만 하면 자동)
```

- **CI (GitHub Actions)** = Jenkins 파이프라인의 "빌드 검증" 역할. `main` 에 push 하거나
  Pull Request 를 올릴 때마다 `.github/workflows/ci.yml` 이 자동 실행돼
  `npm run lint`, `npm run typecheck`, `npm run build` 를 돌립니다.
  실패하면 GitHub 의 PR 화면에 ❌ 로 표시돼, 문제 있는 코드가 배포되는 걸 막습니다.
- **CD (Vercel)** = 별도 파이프라인을 짤 필요가 없습니다. 저장소만 연결하면
  push 할 때마다 Vercel 이 알아서 빌드·배포합니다.
  - `main` 브랜치 → **프로덕션**(실서비스 주소)에 반영
  - 그 외 브랜치·PR → **프리뷰 URL**(임시 주소)을 자동 생성해, 합치기 전에 눈으로 확인 가능

> 협업 흐름 권장: 기능마다 새 브랜치 → PR 올림 → CI 초록불 + Vercel 프리뷰 확인
> → main 에 머지 → 자동 프로덕션 배포. (형상관리의 브랜치 전략과 동일한 개념)

---

## 부록 B. Vercel 가입부터 도메인 연결까지 (상세)

### B-1. 가입
1. https://vercel.com → **Sign Up**.
2. **Continue with GitHub** 선택(강력 추천). GitHub 계정으로 바로 로그인되고, 저장소
   접근 권한도 이때 함께 부여돼 이후 과정이 매끄럽습니다.
3. 플랜은 **Hobby(무료)** 선택. 개인 프로젝트·학습에 충분합니다.

### B-2. 프로젝트 Import (최초 1회)
1. 대시보드 → **Add New… → Project**.
2. GitHub 저장소 목록에서 이 프로젝트 저장소 옆 **Import** 클릭.
   - 저장소가 안 보이면 **Adjust GitHub App Permissions** → 저장소 접근 허용.
3. 설정:
   - **Framework Preset**: Next.js (자동 인식)
   - **Root Directory**: 저장소에 `nextjs` 폴더째 올렸다면 `nextjs` 로 지정
   - **Environment Variables**: `NEXT_PUBLIC_SUPABASE_URL`,
     `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` 3개 추가
4. **Deploy** → 1~3분 후 `https://저장소이름.vercel.app` 완성.

### B-3. 자동 배포 확인
- 이후 GitHub 에 push 하면 대시보드 **Deployments** 에 새 배포가 자동으로 쌓입니다.
- PR 을 올리면 봇이 **프리뷰 URL** 을 댓글로 달아줍니다(합치기 전 확인용).

### B-4. 내 도메인 연결 (예: `www.mysite.com`)
1. 도메인이 없으면 가비아·후이즈·Cloudflare 등에서 구매(연 1~2만원대).
2. Vercel 프로젝트 → **Settings → Domains** → 도메인 입력 후 **Add**.
3. Vercel 이 안내하는 DNS 레코드를 도메인 등록업체 관리페이지에 입력:
   - 루트 도메인(`mysite.com`) → **A 레코드** 를 Vercel 이 준 IP 로
   - `www` 서브도메인 → **CNAME** 을 `cname.vercel-dns.com` 으로
4. 저장 후 몇 분~수 시간 내 연결 완료. **HTTPS 인증서는 Vercel 이 자동 발급**합니다
   (별도 SSL 구매·갱신 불필요).
5. 연결되면 `.vercel.app` 주소와 내 도메인 둘 다 접속됩니다(원하면 한쪽으로 리다이렉트 설정).

### B-5. 환경변수를 바꿨을 때
- Settings → Environment Variables 에서 값 수정 후, **반드시 Redeploy** 해야 반영됩니다
  (빌드 시점에 주입되기 때문). Deployments → 최신 항목 → **Redeploy**.
