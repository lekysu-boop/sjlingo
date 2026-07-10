# GETTING_STARTED.md — 아주 자세한 시작 가이드

> 상황: **VS Code 와 Node.js 는 이미 설치했다. 그런데 그 다음에 뭘 해야 할지 모르겠다.**
> 이 문서는 "claude.ai 에서 만든 이 코드를 어떻게 내 컴퓨터로 가져와서, 실행하고,
> GitHub 에 올리고, 인터넷에 배포하는가"를 **한 줄도 건너뛰지 않고** 설명합니다.
> (claude.ai ↔ GitHub ↔ VS Code 관계가 헷갈리면 먼저 `WORKFLOW.md` 를 읽으세요.)

---

## 전체 흐름 한눈에

```
STEP 1  claude.ai 에서 코드 다운로드   ← 딱 한 번
STEP 2  VS Code 로 폴더 열기
STEP 3  터미널에서 npm install          (라이브러리 설치)
STEP 4  Supabase 에서 데이터베이스 만들기
STEP 5  .env.local 파일에 접속키 3개 넣기
STEP 6  npm run dev 로 내 컴퓨터에서 실행 → 브라우저 확인
STEP 7  GitHub 에 올리기 (GitHub Desktop)
STEP 8  Vercel 로 인터넷에 배포
STEP 9  앞으로의 개발 리듬 (수정 → 커밋 → 푸시)
```
각 STEP 끝에 **"✅ 확인"** 문장이 있습니다. 그게 되면 다음으로 넘어가세요.

---

## STEP 1. claude.ai 에서 코드 다운로드 (딱 한 번)

1. 지금 이 대화(claude.ai)에서 **`nextjs` 폴더를 zip 으로 다운로드**합니다.
   - 채팅에 이렇게 요청하세요: **"nextjs 폴더를 다운로드하게 해줘"**
   - 그러면 다운로드 카드가 나오고, 클릭하면 `nextjs.zip` 같은 파일이 받아집니다.
2. 받은 zip 을 내 컴퓨터의 알기 쉬운 위치에 풉니다.
   - 윈도우 예: `C:\projects\amgi-master`
   - 맥 예: `~/projects/amgi-master`
   - ⚠️ 폴더 경로에 **한글·공백은 피하세요** (나중에 오류의 원인이 됩니다).

✅ 확인: 압축을 푼 폴더 안에 `app`, `lib`, `hooks`, `supabase`, `package.json`,
`README.md` 같은 것들이 보이면 성공.

> 이 순간부터 **"코드의 원본"은 내 컴퓨터입니다.** 앞으로 claude.ai 에서 이 코드를
> 다시 고치지 않습니다. (이유는 `WORKFLOW.md` 참고)

---

## STEP 2. VS Code 로 폴더 열기

1. VS Code 실행 → 상단 메뉴 **File → Open Folder…**
2. STEP 1 에서 압축을 푼 폴더(예: `amgi-master`)를 선택 → 열기.
3. "이 폴더의 작성자를 신뢰합니까?" 가 뜨면 **Yes, I trust the authors** 클릭.
4. 왼쪽 파일 목록(탐색기)에 폴더 구조가 보입니다.

✅ 확인: 왼쪽에 `app`, `lib`, `README.md` 등이 보임.

### 터미널 여는 법 (앞으로 명령은 전부 여기서 칩니다)
- 상단 메뉴 **Terminal → New Terminal** (또는 단축키: 윈도우 `Ctrl` + `` ` ``, 맥 `Cmd` + `` ` ``)
- 화면 아래쪽에 검은 입력창이 생깁니다. 여기가 "터미널"입니다.
  (Java 개발할 때 쓰던 명령 프롬프트/터미널과 같은 것)
- 터미널 맨 앞에 폴더 경로가 보이는데, `amgi-master` 로 끝나는지 확인하세요.
  (아니라면 `cd 폴더경로` 로 이동. 예: `cd C:\projects\amgi-master`)

---

## STEP 3. 라이브러리 설치 (npm install)

터미널에 아래를 치고 Enter:
```bash
npm install
```
- 무슨 일이 일어나나: `package.json`(= Maven 의 `pom.xml`)에 적힌 라이브러리들을
  인터넷에서 내려받아 `node_modules` 폴더에 넣습니다. 1~3분 걸립니다.
- 진행 중에 노란 경고(warning)는 무시해도 됩니다. **빨간 `npm ERR!` 만 없으면** 성공.

✅ 확인: 왼쪽 파일 목록에 `node_modules` 폴더가 새로 생김.

> `node_modules` 는 용량이 매우 큽니다(수백 MB). 이건 GitHub 에 올리지 않습니다
> (`.gitignore` 에 이미 제외돼 있음). 언제든 `npm install` 로 다시 만들 수 있어서요.

---

## STEP 4. Supabase 에서 데이터베이스 만들기

우리 앱의 데이터(사용자·키워드·기출·점수)를 저장할 DB 입니다. Oracle/MSSQL 자리인데,
설치 없이 웹에서 만듭니다.

1. https://supabase.com 접속 → **Start your project** → GitHub 계정으로 로그인.
2. **New project** 클릭.
   - **Name**: 아무거나 (예: amgi-master)
   - **Database Password**: 아무 비밀번호나 만들고 **어딘가 메모** (나중에 쓸 수 있음)
   - **Region**: `Northeast Asia (Seoul)` 선택 (한국에서 빠름)
   - **Create new project** → 1~2분 기다리면 생성 완료.
3. 왼쪽 메뉴에서 **SQL Editor**(문서 아이콘) 클릭 → **New query**.
4. VS Code 에서 `supabase/schema.sql` 파일을 열고 **전체 내용을 복사**
   (윈도우 `Ctrl+A` 로 전체 선택 → `Ctrl+C`).
5. Supabase 의 SQL Editor 빈 칸에 붙여넣기(`Ctrl+V`) → 오른쪽 아래 **RUN** 클릭.
   - "Success. No rows returned" 가 뜨면 테이블이 전부 만들어진 것입니다.
   - (Oracle 에서 DDL 스크립트 실행하는 것과 똑같습니다.)
6. 이제 접속키를 복사합니다. 왼쪽 아래 **Project Settings**(톱니바퀴) → **API** 메뉴.
   - **Project URL** — 복사해서 메모 (예: `https://abcd.supabase.co`)
   - **Project API keys** 의 **anon public** — 복사해서 메모
   - **service_role** — **Reveal** 눌러 보이게 한 뒤 복사해서 메모 (⚠️ 절대 공개 금지)

✅ 확인: Project URL, anon 키, service_role 키 3개를 손에 넣음. 왼쪽 **Table Editor**
에 들어가면 `profiles`, `keywords` 등 테이블이 보임.

---

## STEP 5. 접속키를 프로젝트에 넣기 (.env.local)

방금 얻은 키 3개를 앱이 읽을 수 있게 파일에 넣습니다. (Oracle 의 tnsnames/접속정보 자리)

1. VS Code 왼쪽에서 `.env.example` 파일을 찾습니다.
2. 그 파일을 우클릭 → **Copy**, 다시 우클릭 → **Paste**.
   → `.env copy.example` 같은 복사본이 생깁니다.
3. 복사본을 우클릭 → **Rename** → 이름을 정확히 **`.env.local`** 로 바꿉니다.
   (맨 앞의 점 `.` 포함, 오타 없이!)
4. `.env.local` 을 열고 STEP 4 에서 메모한 값 3개를 등호 뒤에 붙여넣습니다:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://abcd.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...(anon 키 전체)
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...(service_role 키 전체)
   ```
   - 등호(`=`) 앞뒤에 공백을 넣지 마세요.
   - 따옴표는 필요 없습니다. 값 전체를 그대로 붙여넣으면 됩니다.
5. 저장 (`Ctrl+S`).

✅ 확인: `.env.local` 에 3줄이 채워짐. (이 파일은 비밀이라 GitHub 에 안 올라갑니다)

---

## STEP 6. 내 컴퓨터에서 실행해 보기

터미널에:
```bash
npm run dev
```
- 잠시 후 터미널에 `▲ Next.js ...` 와 함께 `Local: http://localhost:3000` 이 뜹니다.
- 브라우저를 열고 주소창에 **http://localhost:3000** 입력 → Enter.
- **로그인(사용자 선택) 화면이 뜨면 대성공입니다!** 🎉
- 신규 사용자를 하나 등록해 보고, 홈·학습 화면을 눌러 보세요. (데이터가 Supabase 에 저장됩니다)

멈추는 법: 터미널에서 `Ctrl + C`.
다시 켜는 법: `npm run dev`.

✅ 확인: 브라우저에서 앱이 뜨고, 사용자 등록·학습이 됨.

> 코드를 고치고 저장(`Ctrl+S`)하면 브라우저가 **자동으로 새로고침**됩니다.
> 시험 삼아 `app/home/page.tsx` 에서 "반가워요" 글자를 바꿔 저장해 보세요.

### 배포 전에 알아두면 좋은 검사 명령
| 명령 | 하는 일 |
|---|---|
| `npm run lint` | 문법·품질 검사 (Checkstyle 같은 것) |
| `npm run typecheck` | 타입 오류 검사 |
| `npm run test` | 준비된 예시 단위 테스트 실행 (JUnit 같은 것) |
| `npm run build` | 배포용 빌드가 되는지 확인 (mvn package) |

---

## STEP 7. GitHub 에 올리기 (원본 백업 + 배포 준비)

**GitHub Desktop**(마우스 방식)을 권장합니다. (명령어 방식은 `DEPLOY.md` STEP 4-B)

1. https://desktop.github.com → 설치 → GitHub 계정으로 로그인.
   (GitHub 계정이 없으면 https://github.com 에서 무료 가입 먼저)
2. GitHub Desktop 메뉴 **File → Add local repository** → 이 프로젝트 폴더 선택.
   - "This directory does not appear to be a Git repository" 경고가 뜨면
     파란 글씨 **create a repository** 클릭 → 아래 **Create repository** 버튼.
3. 첫 저장(커밋): 왼쪽 아래 **Summary** 칸에 `first commit` 입력 →
   **Commit to main** 버튼 클릭.
4. 오른쪽 위 **Publish repository** 클릭 →
   - **Keep this code private** 체크 (나만 보기) → **Publish repository**.

✅ 확인: https://github.com 의 내 저장소 목록에 이 프로젝트가 보임.

> 용어: **commit** = 지금 상태를 도장 찍어 저장(체크인), **push/publish** = GitHub 로 업로드.
> `.env.local` 은 자동 제외되어 안 올라갑니다(정상).

---

## STEP 8. Vercel 로 인터넷에 배포

1. https://vercel.com → **Continue with GitHub** 로 가입/로그인.
2. **Add New… → Project** → 방금 올린 GitHub 저장소 옆 **Import**.
   - 저장소가 안 보이면 **Adjust GitHub App Permissions** 로 접근 허용.
3. 설정 화면에서:
   - **Framework Preset**: Next.js (자동 인식됨)
   - **Root Directory**: 폴더 구조에 따라 다름.
     - zip 을 풀었을 때 최상위가 바로 `app`, `lib` 이면 그대로 두기.
     - 최상위가 `nextjs` 폴더면 **Edit** 눌러 `nextjs` 선택.
   - **Environment Variables**: STEP 4 의 키 3개를 그대로 추가
     (이름과 값을 하나씩: `NEXT_PUBLIC_SUPABASE_URL` 등 3개).
4. **Deploy** 클릭 → 1~3분 빌드 → `https://저장소이름.vercel.app` 주소 완성! 🎉

✅ 확인: 발급된 `.vercel.app` 주소로 접속하면 내 앱이 인터넷에 뜸.

---

## STEP 9. 앞으로의 개발 리듬 (매번 반복)

이제부터는 이 4단계를 반복하면 됩니다. 어렵지 않습니다.

```
① VS Code 에서 코드 수정하고 저장
② 터미널의 npm run dev 로 브라우저에서 결과 확인
③ GitHub Desktop 에서 Summary 쓰고 → Commit → Push origin
④ Vercel 이 자동으로 새 버전을 인터넷에 반영 (몇 분 뒤)
```

- `npm run dev` 는 한 번 켜두면 계속 돌아갑니다. 코드 저장할 때마다 자동 새로고침.
- 의미 있는 변경마다 커밋하세요 (예: "기출 5지선다 지원 추가").
- 예전 FTP 업로드가 "Commit → Push" 로 바뀐 것뿐입니다.

---

## 막힐 때 빠른 점검표

| 증상 | 해결 |
|---|---|
| 터미널에서 `npm` 을 모른다고 함 | Node.js 설치 확인(`node -v`), VS Code 재시작 |
| `npm install` 이 빨간 오류로 멈춤 | 인터넷 확인 후 재시도. 폴더 경로에 한글/공백 없는지 확인 |
| 앱은 뜨는데 데이터가 안 나옴/오류 | `.env.local` 키 3개 오타·누락 확인 → 터미널 `Ctrl+C` 후 `npm run dev` 재실행 |
| `http://localhost:3000` 접속 안 됨 | `npm run dev` 가 켜져 있는지, 3000 포트 메시지가 떴는지 확인 |
| 포트 3000 이 이미 쓰임 | 다른 dev 가 켜져 있음. 그 터미널에서 `Ctrl+C` |
| Vercel 배포는 됐는데 데이터 오류 | Vercel → Settings → Environment Variables 3개 확인 후 **Redeploy** |
| SQL 실행 오류 | `schema.sql` 을 **전체** 복사했는지 확인. 이미 만든 테이블이면 무시 가능 |

---

## 다음에 읽을 것
1. **`WORKFLOW.md`** — claude.ai ↔ GitHub ↔ VS Code 관계(가장 헷갈리는 부분)
2. **`LEARN.md`** — 모던 JS 문법·React·Next 개념 (기존 지식에 비유)
3. **`app/api/users/route.ts`** — 주석이 가장 자세한 API. 여기서 패턴 익히기
4. **`GUIDE.md`** — 개발 도구·협업·풀스택 로드맵
5. **`DEPLOY.md`** — 배포·도메인·CI/CD 상세
