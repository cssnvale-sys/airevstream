/**
 * Enhanced form hook with validation and error handling
 */

import { useState, useCallback, useRef, FormEvent } from 'react';
import { z } from 'zod';
import { validateForm, ValidationResult, sanitizeString } from '@/lib/form-validation';
import { toast } from '@/lib/toast';

interface UseFormOptions<T> {
  /** Zod schema for validation */
  schema: z.ZodType<T>;
  /** Initial form values */
  initialValues: Partial<T>;
  /** Submit handler - called only if validation passes */
  onSubmit: (values: T) => Promise<void> | void;
  /** Success message to show after submit */
  successMessage?: string;
  /** Error message prefix */
  errorMessage?: string;
  /** Form name for error messages */
  formName?: string;
  /** Reset form after successful submit */
  resetOnSuccess?: boolean;
  /** Debounce validation on change (ms) */
  validateDelay?: number;
}

interface FormState<T> {
  values: Partial<T>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
  isDirty: boolean;
}

interface UseFormReturn<T> {
  /** Current form state */
  state: FormState<T>;
  /** Field value getter */
  getValue: <K extends keyof T>(key: K) => T[K] | undefined;
  /** Field value setter */
  setValue: <K extends keyof T>(key: K, value: T[K]) => void;
  /** Field error getter */
  getError: (key: keyof T) => string | undefined;
  /** Check if field is touched */
  isTouched: (key: keyof T) => boolean;
  /** Mark field as touched */
  touch: (key: keyof T) => void;
  /** Validate single field */
  validateField: (key: keyof T) => boolean;
  /** Validate entire form */
  validate: () => ValidationResult<T>;
  /** Handle field change */
  handleChange: <K extends keyof T>(key: K) => (value: T[K]) => void;
  /** Handle text input change */
  handleTextChange: (key: keyof T) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  /** Handle checkbox change */
  handleCheckboxChange: (key: keyof T) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Handle form submission */
  handleSubmit: (e?: FormEvent) => Promise<void>;
  /** Reset form to initial values */
  reset: () => void;
  /** Clear all errors */
  clearErrors: () => void;
  /** Set field error manually */
  setError: (key: keyof T, message: string) => void;
  /** Clear single field error */
  clearError: (key: keyof T) => void;
}

export function useForm<T extends Record<string, unknown>>({
  schema,
  initialValues,
  onSubmit,
  successMessage,
  errorMessage = 'Form submission failed',
  formName,
  resetOnSuccess = false,
  validateDelay = 300,
}: UseFormOptions<T>): UseFormReturn<T> {
  const [state, setState] = useState<FormState<T>>({
    values: { ...initialValues },
    errors: {},
    touched: {},
    isSubmitting: false,
    isValid: false,
    isDirty: false,
  });

  const validateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getValue = useCallback(<K extends keyof T>(key: K): T[K] | undefined => {
    return state.values[key] as T[K] | undefined;
  }, [state.values]);

  const setValue = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setState((prev) => ({
      ...prev,
      values: { ...prev.values, [key]: value },
      isDirty: true,
    }));

    // Clear error when value changes
    if (state.errors[key as string]) {
      clearError(key);
    }

    // Debounced validation
    if (validateTimeoutRef.current) {
      clearTimeout(validateTimeoutRef.current);
    }
    validateTimeoutRef.current = setTimeout(() => {
      validateField(key);
    }, validateDelay);
  }, [state.errors, validateDelay]);

  const getError = useCallback((key: keyof T): string | undefined => {
    return state.touched[key as string] ? state.errors[key as string] : undefined;
  }, [state.errors, state.touched]);

  const isTouched = useCallback((key: keyof T): boolean => {
    return !!state.touched[key as string];
  }, [state.touched]);

  const touch = useCallback((key: keyof T) => {
    setState((prev) => ({
      ...prev,
      touched: { ...prev.touched, [key]: true },
    }));
  }, []);

  const validateField = useCallback((key: keyof T): boolean => {
    const result = validateForm(schema, state.values, { showToast: false });
    
    if (!result.success) {
      const fieldError = result.errors[key as string];
      setState((prev) => ({
        ...prev,
        errors: fieldError
          ? { ...prev.errors, [key]: fieldError }
          : Object.fromEntries(Object.entries(prev.errors).filter(([k]) => k !== key)),
        isValid: false,
      }));
      return !fieldError;
    }
    
    setState((prev) => ({
      ...prev,
      errors: Object.fromEntries(Object.entries(prev.errors).filter(([k]) => k !== key)),
      isValid: true,
    }));
    return true;
  }, [schema, state.values]);

  const validate = useCallback((): ValidationResult<T> => {
    const result = validateForm(schema, state.values, { 
      showToast: true,
      formName 
    });
    
    if (!result.success) {
      setState((prev) => ({
        ...prev,
        errors: result.errors || {},
        touched: Object.keys(result.errors || {}).reduce((acc, key) => ({
          ...acc,
          [key]: true,
        }), prev.touched),
        isValid: false,
      }));
    } else {
      setState((prev) => ({
        ...prev,
        errors: {},
        isValid: true,
      }));
    }
    
    return result;
  }, [schema, state.values, formName]);

  const handleChange = useCallback(<K extends keyof T>(key: K) => (value: T[K]) => {
    setValue(key, value);
  }, [setValue]);

  const handleTextChange = useCallback((key: keyof T) => 
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value as T[typeof key];
      setValue(key, value);
    }, [setValue]);

  const handleCheckboxChange = useCallback((key: keyof T) => 
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(key, e.target.checked as T[typeof key]);
    }, [setValue]);

  const handleSubmit = useCallback(async (e?: FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    const result = validate();
    if (!result.success) return;

    setState((prev) => ({ ...prev, isSubmitting: true }));

    try {
      await onSubmit(result.data);
      
      if (successMessage) {
        toast.success(successMessage);
      }
      
      if (resetOnSuccess) {
        reset();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : errorMessage;
      toast.error(message);
      console.error('Form submission error:', err);
    } finally {
      setState((prev) => ({ ...prev, isSubmitting: false }));
    }
  }, [validate, onSubmit, successMessage, errorMessage, resetOnSuccess]);

  const reset = useCallback(() => {
    setState({
      values: { ...initialValues },
      errors: {},
      touched: {},
      isSubmitting: false,
      isValid: false,
      isDirty: false,
    });
  }, [initialValues]);

  const clearErrors = useCallback(() => {
    setState((prev) => ({ ...prev, errors: {} }));
  }, []);

  const setError = useCallback((key: keyof T, message: string) => {
    setState((prev) => ({
      ...prev,
      errors: { ...prev.errors, [key]: message },
    }));
  }, []);

  const clearError = useCallback((key: keyof T) => {
    setState((prev) => ({
      ...prev,
      errors: Object.fromEntries(
        Object.entries(prev.errors).filter(([k]) => k !== key)
      ),
    }));
  }, []);

  return {
    state,
    getValue,
    setValue,
    getError,
    isTouched,
    touch,
    validateField,
    validate,
    handleChange,
    handleTextChange,
    handleCheckboxChange,
    handleSubmit,
    reset,
    clearErrors,
    setError,
    clearError,
  };
}
