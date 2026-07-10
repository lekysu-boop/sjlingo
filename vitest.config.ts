// Vitest 설정. (Java 의 surefire 설정과 비슷한 역할)
// 'npm run test' 로 실행됩니다. 기본값으로 충분해 최소만 둡니다.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 테스트 파일 위치 패턴: lib 아래 *.test.ts
    include: ['lib/**/*.test.ts'],
    environment: 'node',
  },
});
