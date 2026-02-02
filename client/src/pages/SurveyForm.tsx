import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { questionSections, BASE_PRICE } from '../data/questions';
import { Question, SurveyAnswer, RepeatableGroupItem, RepeatableField } from '../types/survey';
import { createSurvey } from '../services/api';

export default function SurveyForm() {
  const navigate = useNavigate();
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[] | RepeatableGroupItem[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentSection = questionSections[currentSectionIndex];
  const totalSections = questionSections.length;
  const progress = ((currentSectionIndex + 1) / totalSections) * 100;

  // Check if a question should be visible based on conditional rules
  const isQuestionVisible = (question: Question): boolean => {
    if (!question.conditionalOn) return true;
    const { questionId, values } = question.conditionalOn;
    const answer = answers[questionId];
    if (!answer) return false;
    return values.includes(answer as string);
  };

  // Get visible questions for current section
  const visibleQuestions = useMemo(() => {
    return currentSection.questions.filter(isQuestionVisible);
  }, [currentSection, answers]);

  // Calculate total price
  const priceBreakdown = useMemo(() => {
    const breakdown: { label: string; amount: number }[] = [];
    let additionalTotal = 0;

    questionSections.forEach(section => {
      section.questions.forEach(question => {
        if (!question.priceEffect) return;
        const answer = answers[question.id];
        if (!answer) return;

        let price = 0;
        if (question.priceEffect.type === 'perAnswer' && question.priceEffect.values) {
          price = question.priceEffect.values[answer as string] || 0;
        }

        if (price > 0) {
          breakdown.push({
            label: question.text.length > 20 ? question.text.substring(0, 20) + '...' : question.text,
            amount: price,
          });
          additionalTotal += price;
        }
      });
    });

    return { breakdown, additionalTotal, total: BASE_PRICE + additionalTotal };
  }, [answers]);

  const handleAnswer = (questionId: string, value: string | string[] | RepeatableGroupItem[]) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[questionId];
      return newErrors;
    });
  };

  // 반복 그룹: 항목 추가
  const handleAddGroupItem = (questionId: string, fields: RepeatableField[]) => {
    const currentItems = (answers[questionId] as RepeatableGroupItem[]) || [];
    const newItem: RepeatableGroupItem = {};
    fields.forEach(field => {
      newItem[field.id] = '';
    });
    handleAnswer(questionId, [...currentItems, newItem]);
  };

  // 반복 그룹: 항목 삭제
  const handleRemoveGroupItem = (questionId: string, index: number) => {
    const currentItems = (answers[questionId] as RepeatableGroupItem[]) || [];
    const newItems = currentItems.filter((_, i) => i !== index);
    handleAnswer(questionId, newItems);
  };

  // 반복 그룹: 필드 값 변경
  const handleGroupFieldChange = (questionId: string, itemIndex: number, fieldId: string, value: string) => {
    const currentItems = (answers[questionId] as RepeatableGroupItem[]) || [];
    const newItems = [...currentItems];
    newItems[itemIndex] = { ...newItems[itemIndex], [fieldId]: value };
    handleAnswer(questionId, newItems);
  };

  // 반복 그룹 초기화 (첫 항목 생성)
  const initializeGroupIfNeeded = (question: Question) => {
    if (question.type === 'repeatable_group' && !answers[question.id]) {
      const fields = question.groupFields || [];
      const initialItem: RepeatableGroupItem = {};
      fields.forEach(field => {
        initialItem[field.id] = '';
      });
      setAnswers(prev => ({ ...prev, [question.id]: [initialItem] }));
    }
  };

  const validateSection = (): boolean => {
    const newErrors: Record<string, string> = {};

    visibleQuestions.forEach(question => {
      const answer = answers[question.id];

      // 반복 그룹 검증
      if (question.type === 'repeatable_group') {
        const items = answer as RepeatableGroupItem[] || [];
        const minItems = question.minItems || 1;

        if (question.required && items.length < minItems) {
          newErrors[question.id] = `최소 ${minItems}개 이상의 ${question.itemLabel || '항목'}이 필요합니다.`;
          return;
        }

        // 각 항목의 필수 필드 검증
        let hasFieldError = false;
        items.forEach((item, index) => {
          question.groupFields?.forEach(field => {
            if (field.required && !item[field.id]?.trim()) {
              newErrors[`${question.id}_${index}_${field.id}`] = '필수 항목입니다.';
              hasFieldError = true;
            }
            // 이메일 형식 검증
            if (field.type === 'email' && item[field.id]) {
              const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
              if (!emailPattern.test(item[field.id])) {
                newErrors[`${question.id}_${index}_${field.id}`] = '올바른 이메일 형식을 입력해주세요.';
                hasFieldError = true;
              }
            }
          });
        });

        if (hasFieldError) {
          newErrors[question.id] = '모든 필수 항목을 입력해주세요.';
        }
        return;
      }

      if (question.required) {
        if (!answer || (Array.isArray(answer) && answer.length === 0)) {
          newErrors[question.id] = '필수 항목입니다.';
          return;
        }
      }

      // 이메일 형식 검증
      if (question.type === 'email' && answer) {
        const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailPattern.test(answer as string)) {
          newErrors[question.id] = '올바른 이메일 형식을 입력해주세요.';
        }
      }

      // validation 패턴 검증
      if (question.validation?.pattern && answer) {
        const pattern = new RegExp(question.validation.pattern);
        if (!pattern.test(answer as string)) {
          newErrors[question.id] = '올바른 형식을 입력해주세요.';
        }
      }
    });

    // 기본 정보 섹션에서 추가 검증
    if (currentSection.id === 'basic') {
      // terms가 Accept가 아니면 다음으로 넘어갈 수 없음
      if (answers.agreeTerms && answers.agreeTerms !== '1') {
        newErrors['agreeTerms'] = '서비스 이용에 동의해야 진행할 수 있습니다.';
      }

      // proceedWithCorp가 yes가 아니면 다음으로 넘어갈 수 없음
      if (answers.agreeTerms === '1' && answers.proceedWithCorp && answers.proceedWithCorp !== 'yes') {
        newErrors['proceedWithCorp'] = '계속 진행하시려면 "예"를 선택해주세요.';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateSection()) return;

    if (currentSectionIndex < totalSections - 1) {
      setCurrentSectionIndex(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrev = () => {
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSubmit = async () => {
    if (!validateSection()) return;

    setIsSubmitting(true);

    try {
      const surveyAnswers: SurveyAnswer[] = Object.entries(answers).map(([questionId, value]) => ({
        questionId,
        value,
      }));

      await createSurvey({
        customerInfo: {
          name: answers.name as string,
          email: answers.email as string,
          phone: answers.phone as string,
          company: answers.companyName1 as string,
        },
        answers: surveyAnswers,
        totalPrice: priceBreakdown.total,
      });

      navigate('/success');
    } catch (error) {
      console.error('Submit error:', error);
      alert('제출 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderQuestion = (question: Question) => {
    // 반복 그룹 초기화
    if (question.type === 'repeatable_group') {
      initializeGroupIfNeeded(question);
    }

    const value = answers[question.id] || '';
    const error = errors[question.id];
    const hasPriceEffect = question.priceEffect && question.priceEffect.values;

    return (
      <div key={question.id} className={`question fade-in ${error ? 'has-error' : ''}`}>
        <label className="question-label">
          <span>{question.text}</span>
          {question.required && <span className="required">*</span>}
          {hasPriceEffect && <span className="question-price-tag">가격 영향</span>}
        </label>

        {question.description && (
          <p className="question-description">{question.description}</p>
        )}

        {renderInput(question, value, error)}

        {error && <p style={{ color: 'var(--color-error)', fontSize: '0.85rem', marginTop: '8px' }}>{error}</p>}
      </div>
    );
  };

  const renderInput = (question: Question, value: string | string[] | RepeatableGroupItem[], _error?: string) => {
    switch (question.type) {
      case 'text':
      case 'email':
      case 'tel':
      case 'number':
      case 'date':
        return (
          <input
            type={question.type}
            value={value as string}
            onChange={e => handleAnswer(question.id, e.target.value)}
            placeholder={question.placeholder}
          />
        );

      case 'dropdown':
        return (
          <select
            value={value as string}
            onChange={e => handleAnswer(question.id, e.target.value)}
          >
            <option value="">선택해주세요</option>
            {question.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
                {option.price ? ` (+$${option.price.toLocaleString()})` : ''}
              </option>
            ))}
          </select>
        );

      case 'yesno':
        return (
          <div className="yesno-group">
            <button
              type="button"
              className={`yesno-btn ${value === 'yes' ? 'selected yes' : ''}`}
              onClick={() => handleAnswer(question.id, 'yes')}
            >
              예
            </button>
            <button
              type="button"
              className={`yesno-btn ${value === 'no' ? 'selected no' : ''}`}
              onClick={() => handleAnswer(question.id, 'no')}
            >
              아니오
            </button>
          </div>
        );

      case 'radio':
        return (
          <div className="option-group">
            {question.options?.map(option => (
              <label
                key={option.value}
                className={`option-item ${value === option.value ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name={question.id}
                  value={option.value}
                  checked={value === option.value}
                  onChange={e => handleAnswer(question.id, e.target.value)}
                />
                <span className="option-label">{option.label}</span>
                {option.price !== undefined && option.price > 0 && (
                  <span className="option-price">+${option.price.toLocaleString()}</span>
                )}
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        const selectedValues = (value as string[]) || [];
        return (
          <div className="option-group">
            {question.options?.map(option => (
              <label
                key={option.value}
                className={`option-item ${selectedValues.includes(option.value) ? 'selected' : ''}`}
              >
                <input
                  type="checkbox"
                  value={option.value}
                  checked={selectedValues.includes(option.value)}
                  onChange={e => {
                    const newValues = e.target.checked
                      ? [...selectedValues, option.value]
                      : selectedValues.filter(v => v !== option.value);
                    handleAnswer(question.id, newValues);
                  }}
                />
                <span className="option-label">{option.label}</span>
                {option.price !== undefined && option.price > 0 && (
                  <span className="option-price">+${option.price.toLocaleString()}</span>
                )}
              </label>
            ))}
          </div>
        );

      case 'repeatable_group':
        const groupItems = (value as unknown as RepeatableGroupItem[]) || [];
        const fields = question.groupFields || [];
        const maxItems = question.maxItems || 10;
        const minItems = question.minItems || 1;
        const itemLabel = question.itemLabel || '항목';

        return (
          <div className="repeatable-group">
            {groupItems.map((item, itemIndex) => (
              <div key={itemIndex} className="repeatable-group-item">
                <div className="repeatable-group-header">
                  <span className="repeatable-group-title">
                    {itemLabel} {itemIndex + 1}
                  </span>
                  {groupItems.length > minItems && (
                    <button
                      type="button"
                      className="btn btn-sm btn-danger"
                      onClick={() => handleRemoveGroupItem(question.id, itemIndex)}
                    >
                      삭제
                    </button>
                  )}
                </div>
                <div className="repeatable-group-fields">
                  {fields.map(field => {
                    const fieldError = errors[`${question.id}_${itemIndex}_${field.id}`];
                    return (
                      <div key={field.id} className={`repeatable-field ${fieldError ? 'has-error' : ''}`}>
                        <label className="repeatable-field-label">
                          {field.label}
                          {field.required && <span className="required">*</span>}
                        </label>
                        {field.type === 'dropdown' ? (
                          <select
                            value={item[field.id] || ''}
                            onChange={e => handleGroupFieldChange(question.id, itemIndex, field.id, e.target.value)}
                          >
                            <option value="">선택해주세요</option>
                            {field.options?.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={field.type}
                            value={item[field.id] || ''}
                            onChange={e => handleGroupFieldChange(question.id, itemIndex, field.id, e.target.value)}
                            placeholder={field.placeholder}
                          />
                        )}
                        {fieldError && (
                          <p className="field-error">{fieldError}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {groupItems.length < maxItems && (
              <button
                type="button"
                className="btn btn-outline btn-add-item"
                onClick={() => handleAddGroupItem(question.id, fields)}
              >
                + {question.addButtonText || `${itemLabel} 추가`}
              </button>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const formatPrice = (amount: number) => {
    return '$' + amount.toLocaleString();
  };

  return (
    <div className="survey-layout">
      <div className="survey-main">
        <div className="card">
          {/* Progress */}
          <div className="progress-container">
            <div className="progress-header">
              <span className="progress-title">설문 진행률</span>
              <span className="progress-text">{currentSectionIndex + 1} / {totalSections}</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>

          {/* Section Header */}
          <div className="section-header">
            <h2 className="section-title">{currentSection.title}</h2>
            {currentSection.description && (
              <p className="section-description">{currentSection.description}</p>
            )}
          </div>

          {/* Questions */}
          <div className="questions">
            {visibleQuestions.map(renderQuestion)}
          </div>

          {/* Navigation */}
          <div className="nav-buttons">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handlePrev}
              disabled={currentSectionIndex === 0}
            >
              이전
            </button>

            {currentSectionIndex < totalSections - 1 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleNext}
              >
                다음
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-success btn-lg"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? '제출 중...' : '설문 제출하기'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Price Sidebar */}
      <aside className="price-sidebar">
        <div className="price-card">
          <p className="price-card-title">예상 서비스 비용</p>
          <p className="price-total">
            <span className="currency">$</span>
            {priceBreakdown.total.toLocaleString()}
          </p>

          <div className="price-breakdown">
            <div className="price-item base">
              <span className="price-item-label">기본 서비스</span>
              <span className="price-item-value">{formatPrice(BASE_PRICE)}</span>
            </div>

            {priceBreakdown.breakdown.map((item, index) => (
              <div key={index} className="price-item">
                <span className="price-item-label">{item.label}</span>
                <span className="price-item-value">+{formatPrice(item.amount)}</span>
              </div>
            ))}

            {priceBreakdown.breakdown.length === 0 && (
              <p style={{ opacity: 0.7, fontSize: '0.85rem', textAlign: 'center', padding: '8px 0' }}>
                추가 옵션을 선택하면<br />여기에 표시됩니다
              </p>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
