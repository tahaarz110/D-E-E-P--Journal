import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { open } from '@tauri-apps/api/dialog';
import { useSchema } from '../../contexts/SchemaContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useTheme } from '../../contexts/ThemeContext';
import FormFieldRenderer from './FormFieldRenderer';
import ValidationEngine from '../../utils/ValidationEngine';
import ImageProcessor from '../../utils/ImageProcessor';
import FormLayoutEngine from '../../utils/FormLayoutEngine';
import { 
  FormField, 
  FormSchema, 
  FieldValidation, 
  FormData,
  FormConfig,
  FieldDependency 
} from '../../types/dynamicForm';

// Types
interface DynamicFormProps {
  entityName: string;
  onSubmit: (data: FormData) => Promise<void>;
  onCancel?: () => void;
  onSaveDraft?: (data: FormData) => Promise<void>;
  initialData?: FormData;
  mode?: 'create' | 'edit' | 'view';
  formId?: string;
  config?: Partial<FormConfig>;
}

// Default form configuration
const DEFAULT_FORM_CONFIG: FormConfig = {
  layout: 'responsive',
  validation: 'onSubmit',
  autoSave: false,
  autoSaveInterval: 30000,
  showActions: true,
  showDebug: false,
  maxImageSize: 5 * 1024 * 1024, // 5MB
  allowedImageTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
};

const DynamicForm: React.FC<DynamicFormProps> = ({
  entityName,
  onSubmit,
  onCancel,
  onSaveDraft,
  initialData = {},
  mode = 'create',
  formId = 'default',
  config = {}
}) => {
  // Merge default config with provided config
  const formConfig = useMemo((): FormConfig => ({
    ...DEFAULT_FORM_CONFIG,
    ...config
  }), [config]);

  // Context hooks
  const { getSchema, updateSchema, getFieldDependencies } = useSchema();
  const { showNotification } = useNotifications();
  const { isRTL } = useTheme();
  
  // State management
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [formData, setFormData] = useState<FormData>(initialData);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);
  const [fieldDependencies, setFieldDependencies] = useState<FieldDependency[]>([]);

  // Load schema and dependencies
  useEffect(() => {
    initializeForm();
  }, [entityName, formId]);

  const initializeForm = async () => {
    try {
      setIsLoading(true);
      
      // Load schema and dependencies in parallel
      const [entitySchema, dependencies] = await Promise.all([
        getSchema(entityName),
        getFieldDependencies(entityName)
      ]);
      
      setSchema(entitySchema);
      setFieldDependencies(dependencies);

      // Initialize form data with defaults and conditional values
      const initialFormData = initializeFormData(entitySchema, initialData);
      setFormData(initialFormData);

      // Validate initial data if in edit/view mode
      if (mode !== 'create') {
        const errors = ValidationEngine.validateForm(initialFormData, entitySchema.fields);
        setValidationErrors(errors);
      }

    } catch (error) {
      console.error('Error initializing form:', error);
      showNotification('error', `Failed to load form: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize form data with defaults and conditional logic
  const initializeFormData = (schema: FormSchema | null, initialData: FormData): FormData => {
    if (!schema) return initialData;

    const data: FormData = { ...initialData };
    
    schema.fields.forEach(field => {
      // Set default values
      if (data[field.name] === undefined && field.defaultValue !== undefined) {
        data[field.name] = field.defaultValue;
      }

      // Apply conditional defaults based on other fields
      if (field.conditionalDefault) {
        const conditionMet = evaluateCondition(field.conditionalDefault.condition, data);
        if (conditionMet && data[field.name] === undefined) {
          data[field.name] = field.conditionalDefault.value;
        }
      }
    });

    return data;
  };

  // Evaluate conditional logic
  const evaluateCondition = (condition: any, currentData: FormData): boolean => {
    // Simple condition evaluation - in real implementation, this would be more sophisticated
    if (condition.field && condition.operator && condition.value !== undefined) {
      const fieldValue = currentData[condition.field];
      
      switch (condition.operator) {
        case 'equals':
          return fieldValue === condition.value;
        case 'notEquals':
          return fieldValue !== condition.value;
        case 'greaterThan':
          return fieldValue > condition.value;
        case 'lessThan':
          return fieldValue < condition.value;
        case 'contains':
          return String(fieldValue).includes(String(condition.value));
        case 'in':
          return Array.isArray(condition.value) && condition.value.includes(fieldValue);
        default:
          return false;
      }
    }
    
    return false;
  };

  // Handle field changes with dependency tracking
  const handleFieldChange = useCallback((fieldName: string, value: any, fieldType: string) => {
    setFormData(prev => {
      const newData = { ...prev, [fieldName]: value };
      
      // Process field dependencies
      processFieldDependencies(newData, fieldName);
      
      // Auto-calculate derived fields
      calculateDerivedFields(newData, fieldName);
      
      return newData;
    });

    // Mark field as touched
    setTouchedFields(prev => new Set(prev).add(fieldName));
    setIsDirty(true);

    // Clear validation error for this field
    setValidationErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });

    // Real-time validation if configured
    if (formConfig.validation === 'realTime') {
      validateField(fieldName, value);
    }

    // Handle auto-save
    if (formConfig.autoSave && onSaveDraft) {
      scheduleAutoSave();
    }
  }, [formConfig, onSaveDraft]);

  // Process field dependencies
  const processFieldDependencies = useCallback((currentData: FormData, changedField: string) => {
    fieldDependencies.forEach(dependency => {
      if (dependency.sourceField === changedField) {
        const sourceValue = currentData[dependency.sourceField];
        const shouldShow = evaluateCondition(dependency.condition, currentData);
        
        // Show/hide dependent fields
        if (dependency.action === 'show') {
          // Implementation for showing/hiding fields
        } else if (dependency.action === 'setValue') {
          currentData[dependency.targetField] = dependency.value;
        } else if (dependency.action === 'enable') {
          // Implementation for enabling/disabling fields
        }
      }
    });
  }, [fieldDependencies]);

  // Calculate derived fields (P/L, Risk-Reward, etc.)
  const calculateDerivedFields = useCallback((currentData: FormData, changedField: string) => {
    if (!schema) return;

    const calculations = {
      // Profit/Loss Calculation
      calculateProfitLoss: () => {
        const entryPrice = currentData.entry_price;
        const exitPrice = currentData.exit_price;
        const tradeType = currentData.trade_type;
        const volume = currentData.volume || 1;
        const symbol = currentData.symbol;

        if (entryPrice && exitPrice) {
          const priceDiff = exitPrice - entryPrice;
          const profitLoss = tradeType === 'Sell' ? -priceDiff : priceDiff;
          
          // Calculate pip value based on symbol (simplified)
          const pipValue = symbol?.includes('JPY') ? 0.01 : 0.0001;
          const profitLossPips = profitLoss / pipValue;
          
          // Calculate monetary value (simplified - would use proper lot size calculation)
          const profitLossMoney = profitLoss * volume * 100000; // Standard lot

          return {
            profit_loss_pips: Math.round(profitLossPips * 100) / 100,
            profit_loss_money: Math.round(profitLossMoney * 100) / 100,
            is_win: profitLossMoney > 0
          };
        }
        return {};
      },

      // Risk/Reward Ratio Calculation
      calculateRiskReward: () => {
        const entryPrice = currentData.entry_price;
        const sl = currentData.sl;
        const tp = currentData.tp;

        if (entryPrice && sl && tp) {
          const risk = Math.abs(entryPrice - sl);
          const reward = Math.abs(tp - entryPrice);
          const riskReward = risk > 0 ? reward / risk : 0;

          return { 
            risk_reward_ratio: Math.round(riskReward * 100) / 100,
            risk_per_trade: risk
          };
        }
        return {};
      },

      // Position Size Calculation
      calculatePositionSize: () => {
        const accountSize = currentData.account_size;
        const riskPercent = currentData.risk_percent;
        const sl = currentData.sl;
        const entryPrice = currentData.entry_price;

        if (accountSize && riskPercent && sl && entryPrice) {
          const riskAmount = accountSize * (riskPercent / 100);
          const priceRisk = Math.abs(entryPrice - sl);
          const positionSize = priceRisk > 0 ? riskAmount / priceRisk : 0;

          return { 
            calculated_position_size: Math.round(positionSize * 100) / 100,
            risk_amount: riskAmount
          };
        }
        return {};
      },

      // Commission Calculation
      calculateCommission: () => {
        const volume = currentData.volume;
        const commissionPerLot = currentData.commission_per_lot;

        if (volume && commissionPerLot) {
          const commission = volume * commissionPerLot;
          return { commission: Math.round(commission * 100) / 100 };
        }
        return {};
      }
    };

    let updates: FormData = {};
    
    // Determine which calculations to run based on changed field
    const calculationTriggers: Record<string, (() => FormData)[]> = {
      'entry_price': [calculations.calculateProfitLoss, calculations.calculateRiskReward, calculations.calculatePositionSize],
      'exit_price': [calculations.calculateProfitLoss],
      'trade_type': [calculations.calculateProfitLoss],
      'volume': [calculations.calculateProfitLoss, calculations.calculateCommission],
      'sl': [calculations.calculateRiskReward, calculations.calculatePositionSize],
      'tp': [calculations.calculateRiskReward],
      'account_size': [calculations.calculatePositionSize],
      'risk_percent': [calculations.calculatePositionSize],
      'commission_per_lot': [calculations.calculateCommission]
    };

    const triggers = calculationTriggers[changedField] || [];
    triggers.forEach(calculation => {
      updates = { ...updates, ...calculation() };
    });

    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      setFormData(prev => ({ ...prev, ...updates }));
    }
  }, [schema]);

    // Image handling with advanced features
    const handleImageUpload = useCallback(async (fieldName: string) => {
      try {
        const selected = await open({
          multiple: false,
          filters: [{
            name: 'Images',
            extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp']
          }]
        });
  
        if (selected && !Array.isArray(selected)) {
          showNotification('info', 'Processing image...');
          
          // Validate image size and type
          const fileInfo = await invoke<{ size: number; mimeType: string }>('get_file_info', { path: selected });
          
          if (fileInfo.size > formConfig.maxImageSize) {
            showNotification('error', `Image size too large. Maximum allowed: ${formConfig.maxImageSize / 1024 / 1024}MB`);
            return;
          }
  
          if (!formConfig.allowedImageTypes.includes(fileInfo.mimeType)) {
            showNotification('error', `Invalid image type. Allowed types: ${formConfig.allowedImageTypes.join(', ')}`);
            return;
          }
  
          // Process image (resize, compress, generate thumbnail)
          const processedImage = await ImageProcessor.processImage(selected, {
            maxWidth: 1920,
            maxHeight: 1080,
            quality: 0.8,
            generateThumbnail: true
          });
  
          if (processedImage) {
            handleFieldChange(fieldName, processedImage.path, 'image');
            showNotification('success', 'Image uploaded and processed successfully');
          }
        }
      } catch (error) {
        console.error('Error uploading image:', error);
        showNotification('error', 'Failed to upload image');
      }
    }, [formConfig, handleFieldChange, showNotification]);
  
    // Validation functions
    const validateField = useCallback((fieldName: string, value: any) => {
      if (!schema) return;
  
      const field = schema.fields.find(f => f.name === fieldName);
      if (!field || !field.validation) return;
  
      const errors = ValidationEngine.validateField(value, field.validation, field);
      setValidationErrors(prev => ({
        ...prev,
        [fieldName]: errors.length > 0 ? errors[0] : undefined
      }));
    }, [schema]);
  
    const validateForm = useCallback((): boolean => {
      if (!schema) return false;
  
      const errors = ValidationEngine.validateForm(formData, schema.fields);
      setValidationErrors(errors);
      
      return Object.keys(errors).length === 0;
    }, [schema, formData]);
  
    // Auto-save functionality
    const scheduleAutoSave = useCallback(() => {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
  
      const timer = setTimeout(async () => {
        if (onSaveDraft && isDirty) {
          try {
            await onSaveDraft(formData);
            setDraftSaved(true);
            setIsDirty(false);
            showNotification('info', 'Draft saved automatically');
          } catch (error) {
            console.error('Auto-save failed:', error);
          }
        }
      }, formConfig.autoSaveInterval);
  
      setAutoSaveTimer(timer);
    }, [autoSaveTimer, onSaveDraft, isDirty, formData, formConfig.autoSaveInterval, showNotification]);
  
    // Form submission with validation
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!validateForm()) {
        showNotification('error', 'Please fix validation errors before submitting');
        // Scroll to first error
        const firstErrorField = Object.keys(validationErrors)[0];
        const element = document.querySelector(`[data-field-name="${firstErrorField}"]`);
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
  
      try {
        setIsSubmitting(true);
        await onSubmit(formData);
        
        // Reset form state on successful submission
        setTouchedFields(new Set());
        setIsDirty(false);
        setDraftSaved(false);
        
        showNotification('success', 
          mode === 'create' ? 'Item created successfully' : 
          mode === 'edit' ? 'Item updated successfully' : 
          'Changes saved successfully'
        );
        
      } catch (error) {
        console.error('Form submission error:', error);
        showNotification('error', `Submission failed: ${error}`);
      } finally {
        setIsSubmitting(false);
      }
    };
  
    // Save draft manually
    const handleSaveDraft = async () => {
      if (!onSaveDraft) return;
  
      try {
        await onSaveDraft(formData);
        setDraftSaved(true);
        setIsDirty(false);
        showNotification('success', 'Draft saved successfully');
      } catch (error) {
        showNotification('error', 'Failed to save draft');
      }
    };
  
    // Reset form
    const handleReset = () => {
      setFormData(initialData);
      setValidationErrors({});
      setTouchedFields(new Set());
      setIsDirty(false);
      setDraftSaved(false);
      showNotification('info', 'Form reset');
    };
  
    // Generate form layout
    const formLayout = useMemo(() => {
      if (!schema) return null;
      return FormLayoutEngine.generateLayout(schema.fields, formConfig.layout);
    }, [schema, formConfig.layout]);
  
    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (autoSaveTimer) {
          clearTimeout(autoSaveTimer);
        }
      };
    }, [autoSaveTimer]);
  
    // Loading state
    if (isLoading) {
      return (
        <div className="flex justify-center items-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading form...</span>
        </div>
      );
    }
  
    if (!schema) {
      return (
        <div className="text-center p-8 text-red-500 dark:text-red-400">
          Failed to load form schema. Please check your configuration.
        </div>
      );
    }
  
    return (
      <div className={`dynamic-form ${isRTL ? 'rtl' : 'ltr'}`}>
        {/* Form Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {mode === 'create' ? `Create New ${entityName}` :
             mode === 'edit' ? `Edit ${entityName}` : 
             `View ${entityName}`}
          </h2>
          {formConfig.autoSave && draftSaved && (
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">
              ✓ Draft saved
            </p>
          )}
        </div>
  
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Form Fields */}
          <div className={formLayout?.containerClassName || 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'}>
            {schema.fields.map((field) => {
              const fieldConfig = formLayout?.fields?.[field.name];
              
              return (
                <div 
                  key={field.name}
                  data-field-name={field.name}
                  className={fieldConfig?.className || `
                    ${field.ui?.colSpan === 'full' ? 'md:col-span-2 lg:col-span-3' : ''}
                    ${field.ui?.colSpan === 'half' ? 'md:col-span-1 lg:col-span-2' : ''}
                    ${validationErrors[field.name] ? 'has-error' : ''}
                    ${touchedFields.has(field.name) ? 'touched' : ''}
                    ${field.ui?.hidden ? 'hidden' : ''}
                  `}
                >
                  <FormFieldRenderer
                    field={field}
                    value={formData[field.name]}
                    onChange={(value) => handleFieldChange(field.name, value, field.type)}
                    onImageUpload={() => handleImageUpload(field.name)}
                    error={validationErrors[field.name]}
                    disabled={mode === 'view' || field.ui?.readonly}
                    mode={mode}
                    isRTL={isRTL}
                  />
                </div>
              );
            })}
          </div>
  
          {/* Form Actions */}
          {formConfig.showActions && (
            <div className={`flex justify-between items-center pt-6 border-t border-gray-200 dark:border-gray-600 ${
              isRTL ? 'flex-row-reverse' : ''
            }`}>
              <div className="flex space-x-3">
                {onCancel && (
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
                
                {onSaveDraft && mode === 'create' && (
                  <button
                    type="button"
                    onClick={handleSaveDraft}
                    disabled={isSubmitting || !isDirty}
                    className="px-6 py-2 border border-blue-300 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    Save Draft
                  </button>
                )}
                
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isSubmitting || !isDirty}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
                >
                  Reset
                </button>
              </div>
  
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center"
                >
                  {isSubmitting && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  )}
                  {mode === 'create' ? 'Create' : mode === 'edit' ? 'Update' : 'Save'}
                </button>
              </div>
            </div>
          )}
        </form>
  
        {/* Debug information (development only) */}
        {formConfig.showDebug && process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-md">
            <h4 className="font-medium mb-2">Form Debug Info:</h4>
            <pre className="text-xs">
              {JSON.stringify({ 
                formData, 
                validationErrors, 
                touchedFields: Array.from(touchedFields),
                isDirty,
                dependencies: fieldDependencies 
              }, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };
  
  export default DynamicForm;