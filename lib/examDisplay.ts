/** 저장된 기출 지문에서 회차 메타와 제시 자료 표기를 화면 표시용으로 분리합니다. */
export function parseQuestionDisplay(raw: string): { meta: string; image: string; text: string } {
  let text = (raw || '').trim();
  let meta = '';
  let image = '';

  const leading = text.match(/^(\*\*)?\[([^\]]+)\](?:\*\*)?\s*/);
  if (leading) {
    const label = leading[2].trim();
    if (leading[1] || /(?:\d+회|기본|심화|\d+번|\d+점)/.test(label)) {
      meta = label;
      text = text.slice(leading[0].length);
    }
  }

  // 실제 통합 시트의 '[그림 설명]', '[자료 설명]' 같은 표기를 지문에서 분리합니다.
  const sourceLabel = text.match(/^\[([^\]]*(?:설명|안내))\]\s*/);
  if (sourceLabel) {
    image = sourceLabel[1].trim();
    text = text.slice(sourceLabel[0].length);
  } else {
    const embeddedImage = text.match(/\[이미지:\s*([^\]]*)\]\s*/);
    if (embeddedImage && embeddedImage.index !== undefined) {
      image = embeddedImage[1].trim();
      text = (text.slice(0, embeddedImage.index) + ' ' + text.slice(embeddedImage.index + embeddedImage[0].length)).trim();
    }
  }

  // 원본 시트 지문 앞에 문항번호가 그대로 남아있는 경우(예: "46. (가) ...")가 있다.
  // 화면에는 세션에서 실제로 푸는 순서 번호만 붙이므로 원본 번호는 제거한다.
  text = text.replace(/^\d{1,3}[.)]\s+/, '');

  return { meta, image, text: text.replace(/\*\*/g, '') };
}
