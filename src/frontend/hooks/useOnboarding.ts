import { useState } from 'react';
import { selectDirectory, analyzeBundledDemo } from '../adapters/localAnalysisAdapter.js';
import type { DirectoryPickerResult } from '../../local-ui/folderPicker.js';
import type { BundledDemoAnalysis } from '../../application/analyzeBundledDemo.js';

export interface FolderPickerUiState {
  status: 'idle' | 'selecting' | 'SELECTED' | 'CANCELLED' | 'PICKER_UNAVAILABLE' | 'PICKER_FAILED';
  path?: string;
  message?: string;
}

export function useOnboarding(
  onPathSelected: (path: string) => void,
  onDemoLoaded: (result: BundledDemoAnalysis) => void,
  onError: (message: string, details?: string[]) => void
) {
  const [pickerState, setPickerState] = useState<FolderPickerUiState>({ status: 'idle' });
  const [tourActive, setTourActive] = useState<boolean>(false);
  const [tourStep, setTourStep] = useState<number>(0);
  const [isDemoLoading, setIsDemoLoading] = useState<boolean>(false);

  async function handleChooseFolder() {
    setPickerState({ status: 'selecting' });
    try {
      const result: DirectoryPickerResult = await selectDirectory();
      if (result.status === 'SELECTED') {
        setPickerState({ status: 'SELECTED', path: result.path });
        onPathSelected(result.path);
      } else if (result.status === 'CANCELLED') {
        setPickerState({ status: 'CANCELLED' });
      } else if (result.status === 'PICKER_UNAVAILABLE') {
        setPickerState({ status: 'PICKER_UNAVAILABLE', message: result.message });
      } else if (result.status === 'PICKER_FAILED') {
        setPickerState({ status: 'PICKER_FAILED', message: result.message });
      }
    } catch (error: any) {
      setPickerState({
        status: 'PICKER_FAILED',
        message: error?.message || 'The directory picker could not be opened. Enter the path manually.'
      });
    }
  }

  async function handleTryDemo() {
    setIsDemoLoading(true);
    try {
      const demoResult = await analyzeBundledDemo();
      onDemoLoaded(demoResult);
    } catch (error: any) {
      onError(
        error?.message || 'The bundled demo could not be analyzed.',
        Array.isArray(error?.details) ? error.details : []
      );
    } finally {
      setIsDemoLoading(false);
    }
  }

  function startTour() {
    setTourStep(0);
    setTourActive(true);
  }

  function stopTour() {
    setTourActive(false);
  }

  function nextStep() {
    setTourStep(prev => (prev < 5 ? prev + 1 : prev));
  }

  function prevStep() {
    setTourStep(prev => (prev > 0 ? prev - 1 : prev));
  }

  return {
    pickerState,
    handleChooseFolder,
    handleTryDemo,
    isDemoLoading,
    tourActive,
    tourStep,
    startTour,
    stopTour,
    nextStep,
    prevStep,
    setTourStep
  };
}
