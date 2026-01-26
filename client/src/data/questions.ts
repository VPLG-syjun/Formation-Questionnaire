import { QuestionSection } from '../types/survey';

export const BASE_PRICE = 0; // 기본 서비스 금액

export const questionSections: QuestionSection[] = [
  {
    id: 'basic',
    title: '기본 정보',
    description: '이 질문지는 FirstRegister가 스타트업 회사 설립을 대행하기 위해 필요한 여러 서류들을 준비하는 과정에 필수적인 정보들을 제공받을 수 있도록 구성되어 있습니다.',
    questions: [
      {
        id: 'email',
        type: 'email',
        text: '이메일 주소',
        description: 'FirstRegister는 하기 기재하시는 Email 주소를 이용해 질문지 내용에 대한 회신을 드리고, Invoice를 발행할 예정입니다. 반드시 정확한 주 Email 주소를 기입하여 주시기 바랍니다.',
        placeholder: 'example@email.com',
        required: true,
        documentField: 'customerEmail',
      },
    ],
  },
  {
    id: 'legal',
    title: '법적 정보',
    description: '본 서비스를 이용함으로써, 이용자는 본 웹사이트에서 제공되는 정보는 변호사-의뢰인 관계에 따른 것이거나 법률적 조언을 주기 위한 것이 아니며, 모든 게재된 정보를 포함한 본 웹사이트는 변호사로부터 제공된 법률적 조언을 대체할 수 없다는 것에 동의하게 됩니다.',
    questions: [
      {
        id: 'agreeTerms',
        type: 'dropdown',
        text: 'By clicking, I further agree to the site\'s Terms of Use.',
        required: true,
        options: [
          { value: 'accept', label: 'Accept' },
          { value: 'deny', label: 'Deny' },
        ],
      },
    ],
  },
  {
    id: 'company',
    title: '회사 정보',
    description: '설립하실 회사에 대한 정보를 입력해주세요.',
    questions: [
      {
        id: 'companyType',
        type: 'dropdown',
        text: '설립 형태를 선택해주세요',
        required: true,
        options: [
          { value: 'llc', label: 'LLC (유한책임회사)', price: 1900 },
          { value: 'corp', label: 'Corporation (주식회사)', price: 1900 },
        ],
        priceEffect: {
          type: 'perAnswer',
          values: { llc: 1900, corp: 1900 },
        },
        conditionalOn: {
          questionId: 'agreeTerms',
          values: ['accept'],
        },
        documentField: 'companyType',
      },
      {
        id: 'companyName1',
        type: 'text',
        text: '희망하는 회사명 (1순위)',
        description: '설립할 회사명을 입력해주세요.',
        required: true,
        documentField: 'companyName1',
      },
      {
        id: 'companyName2',
        type: 'text',
        text: '희망하는 회사명 (2순위)',
        required: false,
        documentField: 'companyName2',
      },
      {
        id: 'companyName3',
        type: 'text',
        text: '희망하는 회사명 (3순위)',
        required: false,
        documentField: 'companyName3',
      },
      {
        id: 'info',
        type: 'text',
        text: '회사에서 제공하는 상품 또는 서비스에 대해 설명해주세요.',
        required: true,
      },
    ],
  },
  {
    id: 'address',
    title: '주소 정보',
    description: '회사 및 대표자 주소 정보를 입력해주세요.',
    questions: [
      {
        id: 'state',
        type: 'text',
        text: '스타트업 설립을 희망하는 주(State)를 기재해주세요.',
        required: true,
      },
      {
        id: 'qual1',
        type: 'yesno',
        text: '등록(Qualification) 대행이 필요하신가요?',
        required: true,
        priceEffect: {
          type: 'perAnswer',
          values: { yes: 500, no: 0 },
        },
        documentField: 'Qual1',
      },
      {
        id: 'qual2',
        type: 'text',
        text: '등록 대행을 원하는 주를 기재해주세요',
        required: true,
        conditionalOn: {
          questionId: 'qual1',
          values: ['yes'],
        },
      },
      {
        id: 'hasUSAddress',
        type: 'yesno',
        text: '미국 내 사업장 주소가 있으신가요?',
        required: true,
      },
      {
        id: 'usAddress',
        type: 'text',
        text: '미국 사업장 주소를 입력하세요.',
        placeholder: 'Suite 100, 123 Main St, City, State, ZIP',
        required: true,
        conditionalOn: {
          questionId: 'hasUSAddress',
          values: ['yes'],
        },
        documentField: 'usAddress',
      },
      {
        id: 'krAddress',
        type: 'text',
        text: '한국 사업장 주소를 입력하세요(영문).',
        placeholder: '123 Gangnam-daero, Gangnam-gu, Seoul, Korea',
        required: true,
        documentField: 'krAddress',
      },
    ],
  },
  {
    id: 'directors',
    title: '이사회 정보',
    description: '이사회 구성원에 대한 정보를 입력해주세요.',
    questions: [
      {
        id: 'directorCount',
        type: 'dropdown',
        text: '멤버/주주 수를 선택해주세요',
        description: '5명 이상인 경우 info@firstregister로 문의해주세요.',
        required: true,
        options: [
          { value: '1', label: '1명' },
          { value: '2', label: '2명' },
          { value: '3', label: '3명' },
          { value: '4', label: '4명' },
        ],
        documentField: 'directorCount',
      },
      {
        id: 'director1Name',
        type: 'text',
        text: '이사 성함 (영문)',
        placeholder: 'Hong Gil Dong',
        required: true,
        documentField: 'director1Name',
      },
      {
        id: 'director2Name',
        type: 'text',
        text: '추가 이사 2 성함 (영문)',
        placeholder: 'Kim Chul Soo',
        required: false,
        conditionalOn: {
          questionId: 'directorCount',
          values: ['2', '3', '4'],
        },
        documentField: 'director2Name',
      },
      {
        id: 'director3Name',
        type: 'text',
        text: '추가 이사 3 성함 (영문)',
        placeholder: 'Lee Young Hee',
        required: false,
        conditionalOn: {
          questionId: 'directorCount',
          values: ['3', '4'],
        },
        documentField: 'director3Name',
      },
      {
        id: 'director4Name',
        type: 'text',
        text: '추가 이사 4 성함 (영문)',
        placeholder: 'Park So Hyun',
        required: false,
        conditionalOn: {
          questionId: 'directorCount',
          values: ['4'],
        },
        documentField: 'director4Name',
      },
    ],
  },
  {
    id: 'members',
    title: '구성원 정보',
    description: '회사 구성원에 대한 정보를 입력해주세요.',
    questions: [
      {
        id: 'memberCount',
        type: 'dropdown',
        text: '멤버/주주 수를 선택해주세요',
        required: true,
        options: [
          { value: '1', label: '1명', price: 0 },
          { value: '2', label: '2명', price: 50000 },
          { value: '3', label: '3명', price: 100000 },
          { value: '4+', label: '4명 이상', price: 150000 },
        ],
        priceEffect: {
          type: 'perAnswer',
          values: { '1': 0, '2': 50000, '3': 100000, '4+': 150000 },
        },
      },
      {
        id: 'member1Name',
        type: 'text',
        text: '대표 멤버 성함 (영문)',
        placeholder: 'Hong Gil Dong',
        required: true,
        documentField: 'member1Name',
      },
      {
        id: 'member1Title',
        type: 'dropdown',
        text: '대표 멤버 직책',
        required: true,
        options: [
          { value: 'CEO', label: 'CEO (최고경영자)' },
          { value: 'President', label: 'President (사장)' },
          { value: 'Manager', label: 'Managing Member (경영 멤버)' },
          { value: 'Director', label: 'Director (이사)' },
        ],
        documentField: 'member1Title',
      },
      {
        id: 'member2Name',
        type: 'text',
        text: '추가 멤버 2 성함 (영문)',
        placeholder: 'Kim Chul Soo',
        required: false,
        conditionalOn: {
          questionId: 'memberCount',
          values: ['2', '3', '4+'],
        },
        documentField: 'member2Name',
      },
      {
        id: 'member3Name',
        type: 'text',
        text: '추가 멤버 3 성함 (영문)',
        placeholder: 'Lee Young Hee',
        required: false,
        conditionalOn: {
          questionId: 'memberCount',
          values: ['3', '4+'],
        },
      },
    ],
  },
  {
    id: 'banking',
    title: '금융 서비스',
    description: '은행 계좌 및 금융 관련 서비스를 선택해주세요.',
    questions: [
      {
        id: 'needBankAccount',
        type: 'yesno',
        text: '미국 법인 은행 계좌 개설 대행이 필요하신가요?',
        description: '대행 수수료 $200이 추가됩니다.',
        required: true,
        priceEffect: {
          type: 'perAnswer',
          values: { yes: 200000, no: 0 },
        },
      },
      {
        id: 'bankPreference',
        type: 'dropdown',
        text: '선호하는 은행을 선택해주세요',
        required: true,
        conditionalOn: {
          questionId: 'needBankAccount',
          values: ['yes'],
        },
        options: [
          { value: 'mercury', label: 'Mercury (온라인 은행 추천)' },
          { value: 'chase', label: 'Chase Bank' },
          { value: 'bofa', label: 'Bank of America' },
          { value: 'relay', label: 'Relay (온라인 은행)' },
          { value: 'other', label: '기타 (상담 필요)' },
        ],
        documentField: 'bankPreference',
      },
      {
        id: 'needEIN',
        type: 'yesno',
        text: 'EIN (고용주 식별번호) 신청 대행이 필요하신가요?',
        description: '은행 계좌 개설 및 세금 신고에 필수입니다. 대행비 $50 추가.',
        required: true,
        priceEffect: {
          type: 'perAnswer',
          values: { yes: 50000, no: 0 },
        },
      },
    ],
  },
  {
    id: 'additional',
    title: '추가 서비스',
    description: '필요한 추가 서비스를 선택해주세요.',
    questions: [
      {
        id: 'needOperatingAgreement',
        type: 'yesno',
        text: 'Operating Agreement (운영 계약서) 작성이 필요하신가요?',
        description: 'LLC 운영에 필수적인 문서입니다. 작성비 $100 추가.',
        required: true,
        priceEffect: {
          type: 'perAnswer',
          values: { yes: 100000, no: 0 },
        },
      },
      {
        id: 'needAnnualReport',
        type: 'yesno',
        text: '연간 보고서(Annual Report) 대행 서비스가 필요하신가요?',
        description: '매년 주정부에 제출해야 하는 보고서입니다. 연 $100 추가.',
        required: true,
        priceEffect: {
          type: 'perAnswer',
          values: { yes: 100000, no: 0 },
        },
      },
      {
        id: 'needVirtualMailbox',
        type: 'yesno',
        text: '가상 우편함(Virtual Mailbox) 서비스가 필요하신가요?',
        description: '미국 우편물을 스캔하여 이메일로 전달해드립니다. 월 $30 추가.',
        required: true,
        priceEffect: {
          type: 'perAnswer',
          values: { yes: 360000, no: 0 },
        },
      },
      {
        id: 'expeditedProcessing',
        type: 'yesno',
        text: '신속 처리(Expedited Processing)를 원하시나요?',
        description: '일반 2-3주 → 신속 3-5일. 추가 비용 $150.',
        required: true,
        priceEffect: {
          type: 'perAnswer',
          values: { yes: 150000, no: 0 },
        },
      },
    ],
  },
  {
    id: 'confirmation',
    title: '최종 확인',
    description: '입력하신 정보를 확인해주세요.',
    questions: [
      {
        id: 'referralSource',
        type: 'dropdown',
        text: '저희 서비스를 어떻게 알게 되셨나요?',
        required: false,
        options: [
          { value: 'search', label: '검색 (네이버 or 구글 등)' },
          { value: 'sns', label: 'SNS (인스타그램 페이스북 등)' },
          { value: 'youtube', label: '유튜브' },
          { value: 'referral', label: '지인 추천' },
          { value: 'blog', label: '블로그' },
          { value: 'other', label: '기타' },
        ],
      },
      {
        id: 'additionalNotes',
        type: 'text',
        text: '추가로 문의하실 사항이 있으신가요?',
        placeholder: '궁금하신 점을 자유롭게 작성해주세요.',
        required: false,
      },
    ],
  },
];

export default questionSections;
