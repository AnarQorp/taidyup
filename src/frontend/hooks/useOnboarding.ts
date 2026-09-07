import { useState } from 'react';
import { selectDirectory, analyzeBundledDemo } from '../adapters/localAnalysisAdapter.js';
import type { DirectoryPickerResult } from '../../local-ui/folderPicker.js';
import type { BundledDemoAnalysis } from '../../application/analyzeBundledDemo.js';

export interface FolderPickerUiState {
  status: 'idle' | 'selecting' | 'SELECTED' | 'CANCELLED' | 'PICKER_UNAVAILABLE' | 'PICKER_FAILED';
  path?: string;
  message?: string;
}

export type DemoCtaState = 'IDLE' | 'LOADING' | 'LOADED' | 'TOUR_ACTIVE' | 'COMPLETED';

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
  const [demoState, setDemoState] = useState<DemoCtaState>('IDLE');

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
    setDemoState('LOADING');
    try {
      const demoResult = await analyzeBundledDemo();
      onDemoLoaded(demoResult);
      setDemoState('LOADED');
    } catch (error: any) {
      setDemoState('IDLE');
      onError(
        error?.message || 'The bundled demo could not be analyzed.',
        Array.isArray(error?.details) ? error.details : []
      );
    }
  }

  function startTour() {
    setTourStep(0);
    setTourActive(true);
    setDemoState('TOUR_ACTIVE');
  }

  function stopTour() {
    setTourActive(false);
    if (demoState === 'TOUR_ACTIVE' || demoState === 'LOADED') {
      setDemoState('COMPLETED');
    }
  }

  function nextStep() {
    setTourStep(prev => (prev < 5 ? prev + 1 : prev));
  }

  function prevStep() {
    setTourStep(prev => (prev > 0 ? prev - 1 : prev));
  }

  function resetDemoState() {
    setDemoState('IDLE');
    setTourActive(false);
    setTourStep(0);
  }

  const ctaState: DemoCtaState = tourActive ? 'TOUR_ACTIVE' : demoState;

  const ctaLabel =
    ctaState === 'LOADING'
      ? 'Analyzing demo…'
      : ctaState === 'LOADED'
      ? 'Show me how to read this'
      : ctaState === 'TOUR_ACTIVE'
      ? 'Tour in progress'
      : ctaState === 'COMPLETED'
      ? 'Restart guided tour'
      : 'Try demo project';

  const ctaDisabled = ctaState === 'LOADING' || ctaState === 'TOUR_ACTIVE';

  function handleCtaClick() {
    if (ctaState === 'IDLE') {
      void handleTryDemo();
    } else if (ctaState === 'LOADED' || ctaState === 'COMPLETED') {
      startTour();
    }
  }

  return {
    pickerState,
    handleChooseFolder,
    handleTryDemo,
    handleCtaClick,
    ctaState,
    ctaLabel,
    ctaDisabled,
    isDemoLoading: ctaState === 'LOADING',
    tourActive,
    tourStep,
    startTour,
    stopTour,
    nextStep,
    prevStep,
    setTourStep,
    resetDemoState
  };
}
