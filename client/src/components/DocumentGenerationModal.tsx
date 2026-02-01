import { useState, useEffect } from 'react';
import {
  TemplateSelection,
  Template,
  selectTemplates,
  generateDocuments,
  getDocumentDownloadURL,
  getManualVariables,
  DocumentResult,
  ManualVariable,
} from '../services/api';
import TemplatePreviewModal from './TemplatePreviewModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  surveyId: string;
  onComplete: () => void;
}

type ModalStep = 'selection' | 'manualInput' | 'generating' | 'complete' | 'error';

export default function DocumentGenerationModal({ isOpen, onClose, surveyId, onComplete }: Props) {
  const [step, setStep] = useState<ModalStep>('selection');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Template selection state
  const [templateSelection, setTemplateSelection] = useState<TemplateSelection | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Manual variables state
  const [manualVariables, setManualVariables] = useState<ManualVariable[]>([]);
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [loadingManualVars, setLoadingManualVars] = useState(false);

  // Generation progress
  const [generatingTemplates, setGeneratingTemplates] = useState<string[]>([]);
  const [completedTemplates, setCompletedTemplates] = useState<string[]>([]);
  const [currentTemplate, setCurrentTemplate] = useState<string>('');

  // Results
  const [results, setResults] = useState<DocumentResult[]>([]);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [zipFilename, setZipFilename] = useState('');

  // Preview state
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Load templates when modal opens
  useEffect(() => {
    if (isOpen && surveyId) {
      loadTemplates();
    }
  }, [isOpen, surveyId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('selection');
      setError('');
      setTemplateSelection(null);
      setSelectedIds(new Set());
      setManualVariables([]);
      setManualValues({});
      setGeneratingTemplates([]);
      setCompletedTemplates([]);
      setCurrentTemplate('');
      setResults([]);
      setDownloadUrl('');
      setZipFilename('');
      setPreviewTemplate(null);
      setShowPreview(false);
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    setLoading(true);
    setError('');

    try {
      const selection = await selectTemplates(surveyId);
      setTemplateSelection(selection);

      // Auto-select required templates
      const requiredIds = new Set(selection.required.map(t => t.id));
      // Also pre-select suggested templates
      selection.suggested.forEach(t => requiredIds.add(t.id));
      setSelectedIds(requiredIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : '템플릿을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTemplate = (templateId: string, isRequired: boolean) => {
    if (isRequired) return; // Required templates cannot be deselected

    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(templateId)) {
        newSet.delete(templateId);
      } else {
        newSet.add(templateId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (!templateSelection) return;

    const allIds = new Set([
      ...templateSelection.required.map(t => t.id),
      ...templateSelection.suggested.map(t => t.id),
      ...templateSelection.optional.map(t => t.id),
    ]);
    setSelectedIds(allIds);
  };

  const handleDeselectAll = () => {
    if (!templateSelection) return;

    // Keep only required templates selected
    const requiredIds = new Set(templateSelection.required.map(t => t.id));
    setSelectedIds(requiredIds);
  };

  const handleManualValueChange = (variableName: string, value: string) => {
    setManualValues(prev => ({
      ...prev,
      [variableName]: value,
    }));
  };

  const handlePreview = (template: Template, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPreviewTemplate(template);
    setShowPreview(true);
  };

  // Proceed to check for manual variables
  const handleProceedToManualInput = async () => {
    if (selectedIds.size === 0) {
      setError('최소 하나의 템플릿을 선택해주세요.');
      return;
    }

    setLoadingManualVars(true);
    setError('');

    try {
      const templateIds = Array.from(selectedIds);
      const response = await getManualVariables(templateIds);

      if (response.variables.length > 0) {
        setManualVariables(response.variables);
        // Initialize values with defaults
        const initialValues: Record<string, string> = {};
        response.variables.forEach(v => {
          if (v.defaultValue) {
            initialValues[v.variableName] = v.defaultValue;
          }
        });
        setManualValues(initialValues);
        setStep('manualInput');
      } else {
        // No manual variables needed, proceed directly to generation
        performGeneration();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '변수 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoadingManualVars(false);
    }
  };

  // Validate manual inputs
  const validateManualInputs = (): boolean => {
    const requiredVars = manualVariables.filter(v => v.required);
    for (const v of requiredVars) {
      if (!manualValues[v.variableName]?.trim()) {
        setError(`필수 항목을 입력해주세요: ${v.variableName}`);
        return false;
      }
    }
    return true;
  };

  // Perform actual document generation
  const performGeneration = async () => {
    setStep('generating');
    setError('');

    const templateIds = Array.from(selectedIds);
    setGeneratingTemplates(templateIds);
    setCompletedTemplates([]);

    // Filter out empty manual values
    const overrides: Record<string, string> = {};
    Object.entries(manualValues).forEach(([key, value]) => {
      if (value && value.trim()) {
        overrides[key] = value.trim();
      }
    });

    // Simulate progress updates (actual generation happens server-side)
    let currentIndex = 0;
    const progressInterval = setInterval(() => {
      if (currentIndex < templateIds.length) {
        setCurrentTemplate(templateIds[currentIndex]);
        if (currentIndex > 0) {
          setCompletedTemplates(prev => [...prev, templateIds[currentIndex - 1]]);
        }
        currentIndex++;
      }
    }, 500);

    try {
      const response = await generateDocuments(surveyId, templateIds, overrides);

      clearInterval(progressInterval);
      setCompletedTemplates(templateIds);
      setCurrentTemplate('');

      setResults(response.documents);
      setDownloadUrl(response.downloadUrl);
      setZipFilename(response.zipFile);
      setStep('complete');
      onComplete();
    } catch (err) {
      clearInterval(progressInterval);
      setError(err instanceof Error ? err.message : '문서 생성에 실패했습니다.');
      setStep('error');
    }
  };

  // Handle generation from manual input step
  const handleGenerateFromManualInput = () => {
    if (!validateManualInputs()) return;
    performGeneration();
  };

  const handleDownloadZip = () => {
    if (downloadUrl) {
      window.open(getDocumentDownloadURL(downloadUrl.split('/').pop() || ''), '_blank');
    }
  };

  const getTemplateName = (templateId: string): string => {
    if (!templateSelection) return templateId;

    const allTemplates = [
      ...templateSelection.required,
      ...templateSelection.suggested,
      ...templateSelection.optional,
    ];
    const template = allTemplates.find(t => t.id === templateId);
    return template?.displayName || template?.name || templateId;
  };

  const getProgressPercentage = (): number => {
    if (generatingTemplates.length === 0) return 0;
    return Math.round((completedTemplates.length / generatingTemplates.length) * 100);
  };

  const getInputType = (dataType: string): string => {
    switch (dataType) {
      case 'number':
      case 'currency':
        return 'number';
      case 'date':
        return 'date';
      case 'email':
        return 'email';
      default:
        return 'text';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2>
            {step === 'selection' && 'Generate Documents'}
            {step === 'manualInput' && 'Enter Required Information'}
            {step === 'generating' && 'Generating Documents...'}
            {step === 'complete' && 'Documents Generated!'}
            {step === 'error' && 'Generation Failed'}
          </h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {(loading || loadingManualVars) && (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>{loading ? 'Loading templates...' : 'Loading required fields...'}</p>
            </div>
          )}

          {error && step !== 'error' && (
            <div className="message message-error">{error}</div>
          )}

          {/* Selection Step */}
          {step === 'selection' && !loading && templateSelection && (
            <>
              {/* Required Templates */}
              {templateSelection.required.length > 0 && (
                <div className="template-section">
                  <h3 className="template-section-title">
                    <span className="badge badge-required">Required</span>
                    Required Templates (Auto-selected)
                  </h3>
                  <div className="template-list">
                    {templateSelection.required.map(template => (
                      <div key={template.id} className="template-item template-item-required">
                        <input
                          type="checkbox"
                          checked={true}
                          disabled
                        />
                        <span className="template-name">{template.displayName || template.name}</span>
                        <span className="template-category">{template.category}</span>
                        <button
                          className="btn-preview"
                          onClick={(e) => handlePreview(template, e)}
                          title="Preview with survey data"
                        >
                          👁
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Templates */}
              {templateSelection.suggested.length > 0 && (
                <div className="template-section">
                  <h3 className="template-section-title">
                    <span className="badge badge-suggested">Suggested</span>
                    Suggested Templates
                  </h3>
                  <div className="template-list">
                    {templateSelection.suggested.map(template => (
                      <div key={template.id} className="template-item">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(template.id)}
                          onChange={() => handleToggleTemplate(template.id, false)}
                        />
                        <span className="template-name">{template.displayName || template.name}</span>
                        <span className="template-category">{template.category}</span>
                        <button
                          className="btn-preview"
                          onClick={(e) => handlePreview(template, e)}
                          title="Preview with survey data"
                        >
                          👁
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Optional Templates */}
              {templateSelection.optional.length > 0 && (
                <div className="template-section">
                  <h3 className="template-section-title">
                    <span className="badge badge-optional">Optional</span>
                    Other Templates
                  </h3>
                  <div className="template-list">
                    {templateSelection.optional.map(template => (
                      <div key={template.id} className="template-item">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(template.id)}
                          onChange={() => handleToggleTemplate(template.id, false)}
                        />
                        <span className="template-name">{template.displayName || template.name}</span>
                        <span className="template-category">{template.category}</span>
                        <button
                          className="btn-preview"
                          onClick={(e) => handlePreview(template, e)}
                          title="Preview with survey data"
                        >
                          👁
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bulk Actions */}
              <div className="bulk-actions">
                <button type="button" className="btn btn-sm btn-outline" onClick={handleSelectAll}>
                  Select All
                </button>
                <button type="button" className="btn btn-sm btn-outline" onClick={handleDeselectAll}>
                  Deselect All
                </button>
                <span className="selection-count">
                  {selectedIds.size} template(s) selected
                </span>
              </div>
            </>
          )}

          {/* Manual Input Step */}
          {step === 'manualInput' && !loadingManualVars && (
            <div className="manual-input-container">
              <p className="manual-input-description">
                The following information is required to generate your documents.
                Fields marked with <span className="required-mark">*</span> are required.
              </p>

              <div className="manual-input-fields">
                {manualVariables.map(variable => (
                  <div key={variable.variableName} className="form-group">
                    <label>
                      {variable.variableName}
                      {variable.required && <span className="required-mark">*</span>}
                      {variable.usedInTemplates.length > 0 && (
                        <span className="variable-templates" title={variable.usedInTemplates.join(', ')}>
                          (Used in {variable.usedInTemplates.length} template{variable.usedInTemplates.length > 1 ? 's' : ''})
                        </span>
                      )}
                    </label>
                    <input
                      type={getInputType(variable.dataType)}
                      value={manualValues[variable.variableName] || ''}
                      onChange={e => handleManualValueChange(variable.variableName, e.target.value)}
                      placeholder={variable.defaultValue || `Enter ${variable.variableName}`}
                      required={variable.required}
                      className={variable.required && !manualValues[variable.variableName]?.trim() ? 'input-required' : ''}
                    />
                    {variable.dataType !== 'text' && (
                      <span className="input-hint">Type: {variable.dataType}</span>
                    )}
                  </div>
                ))}
              </div>

              <div className="manual-input-summary">
                <span className="summary-total">{manualVariables.length} field(s) total</span>
                <span className="summary-required">
                  {manualVariables.filter(v => v.required).length} required
                </span>
              </div>
            </div>
          )}

          {/* Generating Step */}
          {step === 'generating' && (
            <div className="generating-container">
              <div className="generation-list">
                {generatingTemplates.map(templateId => {
                  const isCompleted = completedTemplates.includes(templateId);
                  const isCurrent = currentTemplate === templateId;
                  const isPending = !isCompleted && !isCurrent;

                  return (
                    <div key={templateId} className={`generation-item ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}>
                      <span className="generation-icon">
                        {isCompleted && '✓'}
                        {isCurrent && <span className="spinner-small"></span>}
                        {isPending && '○'}
                      </span>
                      <span className="generation-name">{getTemplateName(templateId)}</span>
                      <span className="generation-status">
                        {isCompleted && 'Complete'}
                        {isCurrent && 'Generating...'}
                        {isPending && 'Pending'}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="progress-container">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${getProgressPercentage()}%` }}
                  ></div>
                </div>
                <span className="progress-text">{getProgressPercentage()}%</span>
              </div>
            </div>
          )}

          {/* Complete Step */}
          {step === 'complete' && (
            <div className="complete-container">
              <div className="complete-icon">🎉</div>
              <p className="complete-summary">
                {results.filter(r => r.status === 'success').length} document(s) generated successfully
              </p>

              <div className="document-list">
                {results.map(doc => (
                  <div key={doc.templateId} className={`document-item ${doc.status}`}>
                    <span className="document-icon">
                      {doc.status === 'success' ? '📄' : '❌'}
                    </span>
                    <span className="document-filename">
                      {doc.filename || doc.templateName}
                    </span>
                    {doc.status === 'error' && (
                      <span className="document-error">{doc.error}</span>
                    )}
                    {doc.missingVariables && doc.missingVariables.length > 0 && (
                      <span className="document-warning" title={doc.missingVariables.join(', ')}>
                        ⚠️ {doc.missingVariables.length} missing variable(s)
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="download-actions">
                <button className="btn btn-primary btn-lg" onClick={handleDownloadZip}>
                  📦 Download ZIP ({zipFilename})
                </button>
              </div>
            </div>
          )}

          {/* Error Step */}
          {step === 'error' && (
            <div className="error-container">
              <div className="error-icon">❌</div>
              <p className="error-message">{error}</p>
              <button className="btn btn-primary" onClick={() => setStep('selection')}>
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          {step === 'selection' && (
            <>
              <button className="btn btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleProceedToManualInput}
                disabled={selectedIds.size === 0 || loading || loadingManualVars}
              >
                {loadingManualVars ? 'Loading...' : 'Next'}
              </button>
            </>
          )}

          {step === 'manualInput' && (
            <>
              <button className="btn btn-secondary" onClick={() => setStep('selection')}>
                Back
              </button>
              <button
                className="btn btn-primary"
                onClick={handleGenerateFromManualInput}
                disabled={loadingManualVars}
              >
                Generate Documents
              </button>
            </>
          )}

          {step === 'complete' && (
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          )}

          {step === 'error' && (
            <button className="btn btn-secondary" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>

      {/* Template Preview Modal */}
      {previewTemplate && (
        <TemplatePreviewModal
          isOpen={showPreview}
          onClose={() => {
            setShowPreview(false);
            setPreviewTemplate(null);
          }}
          templateId={previewTemplate.id}
          templateName={previewTemplate.displayName || previewTemplate.name}
          surveyId={surveyId}
          useSampleData={false}
        />
      )}
    </div>
  );
}
