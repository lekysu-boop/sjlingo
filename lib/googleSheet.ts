// ============================================================================
//  Google Sheets CSV helpers
// ----------------------------------------------------------------------------
//  네트워크·DB와 무관한 "순수 함수"만 모았습니다. Route Handler에서 분리한 이유는
//  URL 변환과 CSV 파싱을 Supabase 없이도 단위 테스트할 수 있게 하기 위해서입니다.
//
//  처리 흐름:
//    사용자가 붙인 공유 URL -> 공개 CSV URL -> 2차원 문자열 배열 -> 헤더 행 탐색
// ============================================================================

const SHEET_ID_DEFAULT_GID: Record<string, string> = {
  // 현재 한국사 최종본 세 문서는 첫 탭(gid=0)이 실제 적재 대상입니다.
  '1U1CjPfvykkcGrWTyt__RgCHMhuqSvlRygPtmoXCkafU': '0',
  '1lmQ3bFWvlQl7M8S0M9DBSf1TQlW2uGIQs2TElrToB2I': '0',
  '1O_f_xTbwFByE52a86pfNCAQbTIGofkcwmmfaCSdno2o': '0',
};

/** Google Sheets 공유 URL을 공개 CSV 내보내기 URL로 바꿉니다. */
export function toGoogleSheetCsvUrl(url: string): string | null {
  const spreadsheetId = url.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
  if (!spreadsheetId) return null;

  // gid는 문서 안의 "탭" 식별자입니다. 없으면 알려진 문서별 기본 gid를 쓰고,
  // 그것도 없으면 첫 번째 탭(0)을 읽습니다.
  const gid = url.match(/[#&?]gid=(\d+)/)?.[1] ?? SHEET_ID_DEFAULT_GID[spreadsheetId] ?? '0';
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&gid=${gid}`;
}

/**
 * RFC 4180 형태의 CSV를 행/열 배열로 파싱합니다.
 * 셀 안의 쉼표, 줄바꿈, 큰따옴표 이스케이프("")까지 처리합니다.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  // 제목/데이터 사이의 빈 행은 헤더 탐색과 실제 데이터에 필요하지 않습니다.
  return rows.filter((cells) => cells.some((value) => value.trim() !== ''));
}

/** 헤더 이름에 후보 문자열이 포함된 열의 인덱스를 반환합니다. */
export function findColumn(header: string[], candidates: string[]): number {
  return header.findIndex((label) => {
    // 공백·BOM·대소문자 차이를 없애 "핵심 개념"과 "핵심개념"을 같은 헤더로 봅니다.
    const normalized = (label || '').replace(/^\uFEFF/, '').replace(/\s/g, '').toLowerCase();
    return candidates.some((candidate) => normalized.includes(candidate.toLowerCase()));
  });
}

/**
 * 제목·설명 행 아래에 숨어 있는 실제 헤더 행을 찾습니다.
 * 서로 다른 필수 열이 각각 별도 셀에서 발견되어야 헤더로 인정해 안내문의 오탐을 막습니다.
 */
export function findHeaderRow(rows: string[][], requiredColumns: string[][]): number {
  const scanLimit = rows.length;
  for (let rowIndex = 0; rowIndex < scanLimit; rowIndex++) {
    const columnIndexes = requiredColumns.map((candidates) => findColumn(rows[rowIndex], candidates));
    if (
      columnIndexes.every((columnIndex) => columnIndex >= 0) &&
      new Set(columnIndexes).size === columnIndexes.length
    ) {
      return rowIndex;
    }
  }
  return -1;
}
