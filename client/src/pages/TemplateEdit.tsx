import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { questionSections } from '../data/questions';

interface Template {
  id: string;
  name: string;
  displayName: string;
  category: string;
  filename: string;
  uploadedAt: string;
  isActive: boolean;
}

interface VariableMapping {
  id?: string;
  variableName: string;
  questionId: string;
  dataType: string;
  transformRule: string;
  required: boolean;
}

interface RuleCondition {
  questionId: string;
  operator: string;
  value: string;
}

interface SelectionRule {
  id?: string;
  conditions: RuleCondition[];
  priority: number;
  isAlwaysInclude: boolean;
  isManualOnly: boolean;
}

const CATEGORIES = ['투자', '법인설립', '근로계약', '기타'];

const OPERATORS = [
  { value: '==', label: '같음 (==)' },
  { value: '!=', label: '다름 (!=)' },
  { value: 'contains', label: '포함함' },
  { value: 'not_contains', label: '포함하지 않음' },
  { value: 'in', label: '다음 중 하나 (in)' },
  { value: '>', label: '크다 (>)' },
  { value: '>=', label: '크거나 같다 (>=)' },
  { value: '<', label: '작다 (<)' },
  { value: '<=', label: '작거나 같다 (<=)' },
];

const DATA_TYPES = [
  { value: 'text', label: '텍스트' },
  { value: 'date', label: '날짜' },
  { value: 'number', label: '숫자' },
  { value: 'currency', label: '금액' },
  { value: 'email', label: '이메일' },
  { value: 'phone', label: '전화번호' },
];

const TRANSFORM_RULES: Record<string, { value: string; label: string }[]> = {
  text: [
    { value: 'none', label: 'None' },
    { value: 'uppercase', label: 'UPPERCASE' },
    { value: 'lowercase', label: 'lowercase' },
    { value: 'capitalize', label: 'Capitalize' },
    { value: 'title', label: 'Title Case' },
  ],
  date: [
    { value: 'MMMM D, YYYY', label: 'January 1, 2026 (Recommended)' },
    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (ISO)' },
    { value: 'MMM D, YYYY', label: 'Jan 1, 2026' },
    { value: 'none', label: 'None' },
  ],
  number: [
    { value: 'comma', label: 'Comma (1,000,000)' },
    { value: 'none', label: 'None' },
  ],
  currency: [
    { value: 'comma_dollar', label: '$1,000,000 (Recommended)' },
    { value: 'comma_dollar_cents', label: '$1,000,000.00' },
    { value: 'number_english', label: 'One Million Dollars' },
    { value: 'number_korean', label: '일천만원 (Korean)' },
    { value: 'none', label: 'None' },
  ],
  email: [
    { value: 'none', label: 'None (lowercase)' },
  ],
  phone: [
    { value: 'dashed', label: 'Dashed (010-1234-5678)' },
    { value: 'dotted', label: 'Dotted (010.1234.5678)' },
    { value: 'none', label: 'None' },
  ],
};

export default function TemplateEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 기본 정보
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    category: '법인설립',
  });

  // 변수 매핑
  const [variables, setVariables] = useState<VariableMapping[]>([]);
  const [scanning, setScanning] = useState(false);

  // 선택 규칙
  const [rules, setRules] = useState<SelectionRule[]>([]);

  // 새 변수 추가 모달
  const [showAddModal, setShowAddModal] = useState(false);
  const [newVariable, setNewVariable] = useState({
    variableName: '',
    questionId: '__manual__',
    dataType: 'text',
    transformRule: 'none',
    required: true,
  });

  useEffect(() => {
    loadTemplate();
  }, [id]);

  const loadTemplate = async () => {
    if (!id) return;

    try {
      setLoading(true);

      // 템플릿 기본 정보 조회
      const templateRes = await fetch(`/api/templates/${id}`);
      if (!templateRes.ok) throw new Error('템플릿을 찾을 수 없습니다.');
      const templateData = await templateRes.json();
      setTemplate(templateData);
      setFormData({
        name: templateData.name,
        displayName: templateData.displayName,
        category: templateData.category,
      });

      // 변수 매핑 조회
      const varsRes = await fetch(`/api/templates/variables?templateId=${id}`);
      if (varsRes.ok) {
        const varsData = await varsRes.json();
        setVariables(varsData);
      }

      // 선택 규칙 조회
      const rulesRes = await fetch(`/api/templates/rules?templateId=${id}`);
      if (rulesRes.ok) {
        const rulesData = await rulesRes.json();
        setRules(rulesData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleScanVariables = async () => {
    if (!id) return;

    setScanning(true);
    try {
      const response = await fetch('/api/admin/templates/scan-variables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '변수 스캔에 실패했습니다.');
      }

      const data = await response.json();

      // 기존 변수 목록과 병합 (중복 제거)
      const existingNames = new Set(variables.map(v => v.variableName));
      const newVariables = data.variables
        .filter((name: string) => !existingNames.has(name))
        .map((name: string) => ({
          variableName: name,
          questionId: '__manual__',
          dataType: 'text',
          transformRule: 'none',
          required: true,
        }));

      if (newVariables.length > 0) {
        setVariables([...variables, ...newVariables]);
        alert(`${newVariables.length}개의 새 변수가 추가되었습니다.`);
      } else {
        alert('추가할 새 변수가 없습니다.');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '변수 스캔에 실패했습니다.');
    } finally {
      setScanning(false);
    }
  };

  const handleAddVariable = () => {
    if (!newVariable.variableName.trim()) {
      alert('변수명을 입력해주세요.');
      return;
    }

    // 중복 체크
    if (variables.some(v => v.variableName === newVariable.variableName)) {
      alert('이미 존재하는 변수입니다.');
      return;
    }

    setVariables([...variables, { ...newVariable }]);
    setNewVariable({
      variableName: '',
      questionId: '__manual__',
      dataType: 'text',
      transformRule: 'none',
      required: true,
    });
    setShowAddModal(false);
  };

  const handleDeleteVariable = (index: number) => {
    if (!confirm('이 변수를 삭제하시겠습니까?')) return;
    setVariables(variables.filter((_, i) => i !== index));
  };

  const updateVariable = (index: number, field: keyof VariableMapping, value: string | boolean) => {
    const updated = [...variables];
    updated[index] = { ...updated[index], [field]: value };

    // dataType 변경 시 transformRule 초기화
    if (field === 'dataType') {
      updated[index].transformRule = 'none';
    }

    setVariables(updated);
  };

  // 규칙 관리 함수들
  const addRule = () => {
    const newRule: SelectionRule = {
      conditions: [{ questionId: '', operator: '==', value: '' }],
      priority: rules.length + 1,
      isAlwaysInclude: false,
      isManualOnly: false,
    };
    setRules([...rules, newRule]);
  };

  const deleteRule = (ruleIndex: number) => {
    if (!confirm('이 규칙을 삭제하시겠습니까?')) return;
    const updated = rules.filter((_, i) => i !== ruleIndex);
    // 우선순위 재정렬
    updated.forEach((rule, i) => {
      rule.priority = i + 1;
    });
    setRules(updated);
  };

  const updateRule = (ruleIndex: number, field: keyof SelectionRule, value: unknown) => {
    const updated = [...rules];
    updated[ruleIndex] = { ...updated[ruleIndex], [field]: value };
    setRules(updated);
  };

  const addCondition = (ruleIndex: number) => {
    const updated = [...rules];
    updated[ruleIndex].conditions.push({ questionId: '', operator: '==', value: '' });
    setRules(updated);
  };

  const deleteCondition = (ruleIndex: number, condIndex: number) => {
    const updated = [...rules];
    if (updated[ruleIndex].conditions.length > 1) {
      updated[ruleIndex].conditions = updated[ruleIndex].conditions.filter((_, i) => i !== condIndex);
      setRules(updated);
    }
  };

  const updateCondition = (ruleIndex: number, condIndex: number, field: keyof RuleCondition, value: string) => {
    const updated = [...rules];
    updated[ruleIndex].conditions[condIndex] = {
      ...updated[ruleIndex].conditions[condIndex],
      [field]: value,
    };
    setRules(updated);
  };

  const getQuestionText = (questionId: string) => {
    for (const section of questionSections) {
      const question = section.questions.find(q => q.id === questionId);
      if (question) {
        return question.text.length > 30 ? question.text.substring(0, 30) + '...' : question.text;
      }
    }
    return questionId;
  };

  const handleSave = async () => {
    if (!id) return;

    setSaving(true);
    try {
      // 기본 정보 저장
      const templateRes = await fetch(`/api/templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!templateRes.ok) throw new Error('기본 정보 저장에 실패했습니다.');

      // 변수 매핑 저장
      const varsRes = await fetch('/api/templates/variables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: id,
          variables: variables,
        }),
      });

      if (!varsRes.ok) throw new Error('변수 매핑 저장에 실패했습니다.');

      // 선택 규칙 저장
      const rulesRes = await fetch('/api/templates/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: id,
          rules: rules,
        }),
      });

      if (!rulesRes.ok) throw new Error('선택 규칙 저장에 실패했습니다.');

      alert('저장되었습니다.');
      navigate('/admin/templates');
    } catch (err) {
      alert(err instanceof Error ? err.message : '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading">로딩 중...</div>;
  }

  if (error) {
    return <div className="message message-error">{error}</div>;
  }

  if (!template) {
    return <div className="message message-error">템플릿을 찾을 수 없습니다.</div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <h2 style={{ color: 'var(--color-primary)', fontWeight: 700 }}>
          템플릿 편집
        </h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/admin/templates')}>
            취소
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* 섹션 1: 기본 정보 */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '20px', color: 'var(--color-gray-700)' }}>기본 정보</h3>

        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label>템플릿 이름</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label>화면 표시명</label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ flex: 0.5 }}>
            <label>카테고리</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: '12px', fontSize: '0.9rem', color: 'var(--color-gray-500)' }}>
          파일: {template.filename} | 업로드일: {new Date(template.uploadedAt).toLocaleDateString('ko-KR')}
        </div>
      </div>

      {/* 섹션 2: 변수 매핑 */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ color: 'var(--color-gray-700)' }}>변수 매핑</h3>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              className="btn btn-outline"
              onClick={handleScanVariables}
              disabled={scanning}
            >
              {scanning ? '스캔 중...' : '변수 자동 스캔'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowAddModal(true)}>
              + 변수 추가
            </button>
          </div>
        </div>

        {variables.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <h3 style={{ marginBottom: '8px', color: 'var(--color-gray-700)' }}>변수가 없습니다</h3>
            <p>"변수 자동 스캔" 버튼을 클릭하여 템플릿에서 변수를 추출하거나,<br />"변수 추가" 버튼으로 수동 추가할 수 있습니다.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>변수명</th>
                  <th>설문 질문</th>
                  <th>데이터 타입</th>
                  <th>변환 규칙</th>
                  <th style={{ width: '60px', textAlign: 'center' }}>필수</th>
                  <th style={{ width: '80px' }}>액션</th>
                </tr>
              </thead>
              <tbody>
                {variables.map((variable, index) => (
                  <tr key={index}>
                    <td>
                      <code style={{
                        background: 'var(--color-gray-100)',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                      }}>
                        {`{${variable.variableName}}`}
                      </code>
                    </td>
                    <td>
                      <select
                        value={variable.questionId}
                        onChange={(e) => updateVariable(index, 'questionId', e.target.value)}
                        style={{ width: '100%', minWidth: '200px' }}
                      >
                        <optgroup label="특수 옵션">
                          <option value="__manual__">직접 입력</option>
                          <option value="__calculated__">계산된 값</option>
                        </optgroup>
                        <optgroup label="관리자 설정 날짜">
                          <option value="__COIDate">COIDate (법인설립일)</option>
                          <option value="__SIGNDate">SIGNDate (서명일)</option>
                        </optgroup>
                        {questionSections.map(section => (
                          <optgroup key={section.id} label={section.title}>
                            {section.questions.map(q => (
                              <option key={q.id} value={q.id}>
                                {q.text.length > 40 ? q.text.substring(0, 40) + '...' : q.text}
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={variable.dataType}
                        onChange={(e) => updateVariable(index, 'dataType', e.target.value)}
                        style={{ width: '100%' }}
                      >
                        {DATA_TYPES.map(type => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={variable.transformRule}
                        onChange={(e) => updateVariable(index, 'transformRule', e.target.value)}
                        style={{ width: '100%' }}
                      >
                        {(TRANSFORM_RULES[variable.dataType] || TRANSFORM_RULES.text).map(rule => (
                          <option key={rule.value} value={rule.value}>{rule.label}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={variable.required}
                        onChange={(e) => updateVariable(index, 'required', e.target.checked)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                    </td>
                    <td>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        onClick={() => handleDeleteVariable(index)}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginTop: '16px', fontSize: '0.85rem', color: 'var(--color-gray-500)' }}>
          총 {variables.length}개의 변수
        </div>
      </div>

      {/* 섹션 3: 선택 규칙 */}
      <div className="card" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ color: 'var(--color-gray-700)', marginBottom: '4px' }}>선택 규칙</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--color-gray-500)', margin: 0 }}>
              이 템플릿이 언제 사용되어야 하나요?
            </p>
          </div>
          <button className="btn btn-secondary" onClick={addRule}>
            + 규칙 추가
          </button>
        </div>

        {rules.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <h3 style={{ marginBottom: '8px', color: 'var(--color-gray-700)' }}>규칙이 없습니다</h3>
            <p>"규칙 추가" 버튼을 클릭하여 템플릿 선택 조건을 설정하세요.</p>
          </div>
        ) : (
          <div className="rules-container">
            {rules.map((rule, ruleIndex) => (
              <div key={ruleIndex} className="rule-card">
                <div className="rule-header">
                  <span className="rule-title">규칙 {ruleIndex + 1}</span>
                  <button
                    className="btn btn-danger"
                    style={{ padding: '4px 12px', fontSize: '0.8rem' }}
                    onClick={() => deleteRule(ruleIndex)}
                  >
                    삭제
                  </button>
                </div>

                <div className="rule-body">
                  {/* 특수 옵션 */}
                  <div className="rule-special-options">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={rule.isAlwaysInclude}
                        onChange={(e) => updateRule(ruleIndex, 'isAlwaysInclude', e.target.checked)}
                      />
                      <span>항상 사용</span>
                      <small>(모든 경우에 이 템플릿 포함)</small>
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={rule.isManualOnly}
                        onChange={(e) => updateRule(ruleIndex, 'isManualOnly', e.target.checked)}
                      />
                      <span>수동 선택만</span>
                      <small>(자동 추천 안 함)</small>
                    </label>
                  </div>

                  {/* 조건들 - 항상 사용이 아닐 때만 표시 */}
                  {!rule.isAlwaysInclude && (
                    <div className="rule-conditions">
                      <div className="conditions-label">조건:</div>
                      {rule.conditions.map((condition, condIndex) => (
                        <div key={condIndex} className="condition-row">
                          {condIndex > 0 && (
                            <span className="condition-connector">AND</span>
                          )}
                          <div className="condition-fields">
                            <select
                              value={condition.questionId}
                              onChange={(e) => updateCondition(ruleIndex, condIndex, 'questionId', e.target.value)}
                              className="condition-select"
                            >
                              <option value="">질문 선택...</option>
                              {questionSections.map(section => (
                                <optgroup key={section.id} label={section.title}>
                                  {section.questions.map(q => (
                                    <option key={q.id} value={q.id}>
                                      {q.text.length > 35 ? q.text.substring(0, 35) + '...' : q.text}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                            <select
                              value={condition.operator}
                              onChange={(e) => updateCondition(ruleIndex, condIndex, 'operator', e.target.value)}
                              className="condition-operator"
                            >
                              {OPERATORS.map(op => (
                                <option key={op.value} value={op.value}>{op.label}</option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={condition.value}
                              onChange={(e) => updateCondition(ruleIndex, condIndex, 'value', e.target.value)}
                              placeholder={condition.operator === 'in' ? '값1,값2,값3' : '값 입력'}
                              className="condition-value"
                            />
                            {rule.conditions.length > 1 && (
                              <button
                                className="condition-delete"
                                onClick={() => deleteCondition(ruleIndex, condIndex)}
                                title="조건 삭제"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      <button
                        className="btn btn-outline"
                        style={{ marginTop: '8px', padding: '6px 12px', fontSize: '0.85rem' }}
                        onClick={() => addCondition(ruleIndex)}
                      >
                        + 조건 추가
                      </button>
                    </div>
                  )}

                  {/* 우선순위 */}
                  <div className="rule-priority">
                    <label>우선순위:</label>
                    <select
                      value={rule.priority}
                      onChange={(e) => updateRule(ruleIndex, 'priority', parseInt(e.target.value))}
                    >
                      {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
                        <option key={num} value={num}>{num}</option>
                      ))}
                    </select>
                    <small>(낮을수록 먼저 평가)</small>
                  </div>

                  {/* 규칙 미리보기 */}
                  {!rule.isAlwaysInclude && rule.conditions.some(c => c.questionId && c.value) && (
                    <div className="rule-preview">
                      <strong>규칙 요약:</strong>
                      <code>
                        {rule.conditions
                          .filter(c => c.questionId && c.value)
                          .map((c, i) => {
                            const questionText = getQuestionText(c.questionId);
                            const opLabel = OPERATORS.find(o => o.value === c.operator)?.label || c.operator;
                            return `${i > 0 ? ' AND ' : ''}${questionText} ${opLabel} "${c.value}"`;
                          })
                          .join('')}
                      </code>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '16px', fontSize: '0.85rem', color: 'var(--color-gray-500)' }}>
          총 {rules.length}개의 규칙
        </div>
      </div>

      {/* 변수 추가 모달 */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>변수 추가</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label>변수명 *</label>
                <input
                  type="text"
                  placeholder="예: companyName"
                  value={newVariable.variableName}
                  onChange={(e) => setNewVariable({ ...newVariable, variableName: e.target.value })}
                />
                <small style={{ color: 'var(--color-gray-500)' }}>
                  템플릿에서 {'{'}변수명{'}'} 형식으로 사용됩니다.
                </small>
              </div>

              <div className="form-group">
                <label>설문 질문</label>
                <select
                  value={newVariable.questionId}
                  onChange={(e) => setNewVariable({ ...newVariable, questionId: e.target.value })}
                >
                  <optgroup label="특수 옵션">
                    <option value="__manual__">직접 입력</option>
                    <option value="__calculated__">계산된 값</option>
                  </optgroup>
                  <optgroup label="관리자 설정 날짜">
                    <option value="__COIDate">COIDate (법인설립일)</option>
                    <option value="__SIGNDate">SIGNDate (서명일)</option>
                  </optgroup>
                  {questionSections.map(section => (
                    <optgroup key={section.id} label={section.title}>
                      {section.questions.map(q => (
                        <option key={q.id} value={q.id}>
                          {q.text.length > 40 ? q.text.substring(0, 40) + '...' : q.text}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>데이터 타입</label>
                  <select
                    value={newVariable.dataType}
                    onChange={(e) => setNewVariable({
                      ...newVariable,
                      dataType: e.target.value,
                      transformRule: 'none',
                    })}
                  >
                    {DATA_TYPES.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>변환 규칙</label>
                  <select
                    value={newVariable.transformRule}
                    onChange={(e) => setNewVariable({ ...newVariable, transformRule: e.target.value })}
                  >
                    {(TRANSFORM_RULES[newVariable.dataType] || TRANSFORM_RULES.text).map(rule => (
                      <option key={rule.value} value={rule.value}>{rule.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newVariable.required}
                    onChange={(e) => setNewVariable({ ...newVariable, required: e.target.checked })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  필수 변수
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                취소
              </button>
              <button className="btn btn-primary" onClick={handleAddVariable}>
                추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
