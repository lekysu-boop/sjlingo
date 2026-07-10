# WORKFLOW.md — claude.ai 에서 만든 코드를 내 컴퓨터로 가져와 개발하기

> 지금 가장 헷갈리는 부분을 정확히 풀어드립니다:
> **"claude.ai 에서 만든 코드를 어떻게 GitHub 에 올리고, VS Code 로 개발하나?
> VS Code 에서 고치면 claude.ai 의 코드와 달라지는데 어떻게 관리하지?"**

---

## 0. 딱 하나만 기억하세요 — "원본은 한 곳만"

혼란의 원인은 코드를 **두 곳(claude.ai + VS Code)에서 고칠 수 있다**고 생각하는 것입니다.
정답은 간단합니다:

> **claude.ai = 코드를 "처음 만들어 주는 공장"**
> **GitHub + VS Code = 그 다음부터의 "진짜 작업장(원본)"**

한 번 내 컴퓨터로 가져온 뒤에는 **claude.ai 에서 이 프로젝트 코드를 더 고치지 않습니다.**
그러면 "코드가 달라지는" 문제 자체가 없어집니다. 원본이 GitHub 하나로 정해졌으니까요.

```
[claude.ai]           [내 컴퓨터 = 원본]
  코드 생성   ──1회 다운로드──▶  VS Code 로 개발  ⇄  GitHub(백업·배포)  ──▶  Vercel(서비스)
  (공장)                         (여기서 계속 작업)
```

---

## 1. 큰 그림: 3개의 장소와 각자의 역할

| 장소 | 역할 | 비유 |
|---|---|---|
| **claude.ai** (지금 여기) | 코드를 처음 생성. 개념 질문·조언 | 설계도를 그려주는 사무소 |
| **내 컴퓨터 (VS Code)** | 실제로 코드를 고치고 실행 | 내 작업 책상 |
| **GitHub** | 코드의 원본 보관·이력 관리·배포 연결 | 중앙 문서 보관소(형상관리) |

Classic ASP 시절로 치면: 예전엔 "내 PC 에서 수정 → FTP 로 서버 업로드"였죠.
지금은 "내 PC 에서 수정 → GitHub 에 push → GitHub 를 본 Vercel 이 자동 배포"입니다.
GitHub 이 형상관리(SVN/Git)와 배포 트리거를 겸합니다.

---

## 2. 지금 한 번만 하는 일 — claude.ai 코드를 내 컴퓨터로 가져오기

### 2-1. claude.ai 에서 프로젝트 내려받기
1. 이 대화에서 **`nextjs` 폴더(또는 프로젝트 전체)를 다운로드**합니다.
   (채팅에 "nextjs 폴더를 zip 으로 다운로드하게 해줘" 라고 요청하면 다운로드 카드가 나옵니다.)
2. 받은 zip 을 내 컴퓨터의 원하는 위치에 풉니다. 예: `C:\projects\amgi-master`
   (한글·공백 없는 경로를 권장합니다.)

### 2-2. VS Code 로 열어 확인
1. VS Code → **File → Open Folder** → 방금 푼 `nextjs` 폴더 선택.
2. 왼쪽에 `app`, `lib`, `hooks`, `supabase`, `README.md` 등이 보이면 성공.

> 여기까지가 "공장에서 받아오기"입니다. **이제부터 원본은 내 컴퓨터입니다.**

---

## 3. GitHub 에 올리기 (원본을 중앙 보관소에 등록)

가장 쉬운 **GitHub Desktop**(마우스 방식)을 권장합니다.

1. https://desktop.github.com → 설치 → GitHub 계정으로 로그인.
2. **File → Add local repository** → `nextjs` 폴더 선택.
   → "This directory does not appear to be a Git repository" 가 뜨면
   **create a repository** 를 눌러 Git 저장소로 만듭니다.
3. 아래 **Create repository** 버튼 클릭 (기본값 그대로 OK).
4. 첫 저장: 왼쪽 아래 **Summary** 칸에 `first commit` 이라 쓰고 **Commit to main** 클릭.
   - **commit(커밋)** = "지금 상태를 도장 찍어 저장" (SVN 의 체크인).
5. 오른쪽 위 **Publish repository** 클릭 →
   - Name 정하고, **Keep this code private** 체크(비공개) → **Publish repository**.
   - 이제 GitHub 웹사이트에 내 코드가 올라갔습니다. (백업 완료)

> **주의**: `.env.local`(접속 비밀번호 파일)은 `.gitignore` 덕분에 **자동으로 안 올라갑니다.**
> GitHub 에 키가 노출되면 안 되므로, 이 파일은 항상 내 컴퓨터에만 둡니다.

---

## 4. 매일의 개발 사이클 (앞으로 계속 반복하는 것)

이게 실제 "개발 리듬"입니다. 어렵지 않습니다.

```
① VS Code 에서 코드 수정
② 브라우저에서 npm run dev 로 결과 확인
③ 만족하면 GitHub Desktop 에서 Commit → Push
④ (배포를 연결했다면) Vercel 이 자동으로 새 버전 배포
```

- **Commit(커밋)**: 의미 있는 변경 한 덩어리를 저장하는 도장. 자주 찍으세요.
  (예: "로그인 버튼 색 변경", "기출 5지선다 지원")
- **Push(푸시)**: 내 커밋들을 GitHub 로 업로드. (백업 + 배포 트리거)
- **Pull(풀)**: GitHub 의 최신 코드를 내 컴퓨터로 내려받기.
  (혼자 한 대의 PC 로 작업하면 거의 쓸 일 없음. 다른 PC·협업 시 사용.)

> 예전 FTP 업로드가 이제 "Commit → Push" 두 번의 클릭으로 바뀐 것뿐입니다.

---

## 5. 그럼 claude.ai 는 앞으로 언제 쓰나?

이 프로젝트 코드를 **직접 고치는 용도로는 안 씁니다.** 대신:

1. **개념·문법 질문**: "이 코드가 무슨 뜻이야?" — 궁금한 **코드 조각을 복사해서**
   claude.ai 채팅에 붙여넣고 물어보세요. (전체 프로젝트를 동기화할 필요 없음)
2. **새 기능 설계 상담**: "이런 기능을 넣으려면 어떤 파일을 고쳐야 해?" 처럼
   방향을 묻고, 실제 수정은 VS Code 에서 내가 합니다.
3. **VS Code 안에서 AI 쓰기 (추천)**: VS Code 에 **GitHub Copilot** 이나
   **Claude 확장/Claude Code** 를 설치하면, 지금 내 코드를 그대로 보면서 AI 도움을
   받을 수 있습니다. 이러면 "코드가 달라지는" 문제가 원천적으로 없습니다.

> 핵심: **원본은 항상 내 컴퓨터/GitHub.** claude.ai 는 참고·상담역으로만.

---

## 6. 자주 하는 오해 정리

| 오해 | 진실 |
|---|---|
| "claude.ai 와 VS Code 코드를 계속 맞춰야 한다" | 아니요. 한 번 가져온 뒤엔 VS Code/GitHub 만 원본입니다 |
| "VS Code 에서 고치면 claude.ai 도 바뀐다" | 아니요. 둘은 분리돼 있습니다. claude.ai 는 그 시점 스냅샷만 압니다 |
| "GitHub 에 올리면 전 세계에 공개된다" | 아니요. **Private** 로 만들면 나만 봅니다 |
| "배포하려면 FTP 로 올려야 한다" | 아니요. GitHub 에 push 하면 Vercel 이 자동 배포합니다 |
| "코드를 잘못 고치면 되돌릴 수 없다" | 아니요. Git 은 커밋마다 이력이 남아 언제든 되돌립니다 |

---

## 7. 신규 프로젝트를 "처음부터" 시작하고 싶을 때

지금 프로젝트가 아니라, 나중에 **완전히 새 앱**을 맨땅에서 시작하는 방법입니다.
(참고용 — 지금 당장은 위 2~4번만 하면 됩니다.)

1. 새 폴더에서 VS Code 터미널 열고:
   ```bash
   npx create-next-app@latest my-app
   ```
   질문이 나오면 보통: TypeScript **Yes**, ESLint **Yes**, App Router **Yes** 선택.
2. `cd my-app` → `npm run dev` 로 빈 앱이 뜨는지 확인.
3. GitHub Desktop 으로 이 폴더를 저장소로 만들고 Publish (위 3번과 동일).
4. Vercel 에서 Import 하면 배포 (DEPLOY.md 참고).
5. 그 다음부터 화면·API 를 하나씩 추가. (이 프로젝트의 `app/`, `lib/` 구조를 참고서로)

> 즉, "create-next-app 으로 빈 뼈대 생성 → GitHub → Vercel" 이 신규 시작 3단계입니다.

---

## 다음 문서
- 설치부터 실행까지 처음이면 → **`GETTING_STARTED.md`**
- 배포·도메인·CI/CD → **`DEPLOY.md`**
- 문법·개념 → **`LEARN.md`**, 도구·로드맵 → **`GUIDE.md`**
