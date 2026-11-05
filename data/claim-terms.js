// 문구 점검용 표현 목록 (README 6-5).
// 출발점일 뿐이다. 단어 하나로 판정을 확정하지 않고, 걸린 단어와 이유를 같이 보여 주고 담당자가 확인한다.
window.DASH_DATA = window.DASH_DATA || {};
window.DASH_DATA.claimTerms = {
  US: {
    disease: ['cure', 'treat', 'prevent', 'diagnose', 'heal', 'disease', '치료', '예방', '완화', '질병']
    // 질병명 목록(예: diabetes, cancer)은 규제 담당이 추가
  },
  JP: {
    excludedTarget: ['임산부', '수유', '어린이', '미성년', '환자', '妊婦', '授乳', '子ども', '病気']
  },
  VN: {
    medicineLike: ['thuốc', 'chữa', 'điều trị', '치료', '약'] // '의약품이 아님' 문구와 충돌하는 표현
  }
};
