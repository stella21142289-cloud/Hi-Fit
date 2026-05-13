// Hi-Fit16 GitHub frontend configuration
// 1) Google Apps Script 웹 앱을 배포한 뒤 /exec URL을 BACKEND_URL에 붙여넣으세요.
// 2) 이 파일은 GitHub에 공개되어도 되는 값만 넣습니다. 비밀번호, API 키, 개인정보를 넣지 마세요.
window.HIFIT16_CONFIG = {
  BACKEND_URL: "https://script.google.com/macros/s/AKfycbwBVGKGAuzH7yBwklao-2uLTI-0MgQHvGgVGpk1Ok8ZCWir7rhxrNhw53Aqs_Ema4gnoA/exec",
  LOGO_URL: "https://raw.githubusercontent.com/stella21142289-cloud/JEILPORTAL/main/jeil-green-bgx.png",
  PAGE_SIZE: 9,
  RESPONSE_LOG: true,
  SHARE_BASE_URL: "",

  // 애니메이션 쾌적 모드
  // full: 항상 애니메이션 유지 / intro-once: 시작화면만 짧게 재생 후 정지 / calm: 처음부터 정적 UI / off: 거의 모든 모션 제거
  ANIMATION_MODE: "intro-once",
  INTRO_ANIMATION_MS: 2600,
  RESULT_CONFETTI: true,
  RESULT_CONFETTI_PIECES: 88,
  RESULT_CONFETTI_FRAMES: 88
};
