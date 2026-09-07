import { useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, FolderSearch } from 'lucide-react';

export interface TourStep {
  anchor: string;
  title: string;
  content: string;
  badge?: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    anchor: 'project',
    title: '1. Bundled Demo Project',
    badge: 'DEMO PATH',
    content: 'This is the bundled project tAIdyup has actually analyzed using the normal local analysis path. The results derive from real technical evidence, workflow artifacts, and sanitized runtime evidence—not a static visual mock.'
  },
  {
    anchor: 'layers',
    title: '2. Four Evidence Questions',
    badge: 'MENTAL MODEL',
    content: 'tAIdyup separates four evidence questions: DECLARED is what the developer or owner says the system should be able to do; OBSERVED is available technical evidence; CONNECTED is point-in-time configuration evidence when explicitly collected; RUNTIME is execution activity represented by the available runtime evidence.'
  },
  {
    anchor: 'supported-runtime',
    title: '3. Supported != Authorized',
    badge: 'EVIDENCE BOUNDARY',
    content: 'SEND is SUPPORTED because compatible declarations and workflow evidence match. But SUPPORTED does NOT mean VERIFIED, AUTHORIZED, SAFE, or COMPLIANT. Evidence of capability is not evidence of permission.'
  },
  {
    anchor: 'interesting-difference',
    title: '4. The Interesting Difference',
    badge: 'EVIDENTIARY VALUE',
    content: 'Notice WRITE is UNVERIFIED (declared without sufficient supporting evidence) while EXECUTE is an UNDECLARED_OBSERVATION (observed in workflow without declaration). In tAIdyup, UNKNOWN and UNVERIFIED are valuable evidence boundaries, not failures.'
  },
  {
    anchor: 'why-unknowns',
    title: '5. What tAIdyup Doesn\'t Know',
    badge: 'SYSTEM UNCERTAINTY',
    content: 'tAIdyup explicitly represents system uncertainty—such as whether downstream effects occurred or if activity happened outside partial coverage. Unknowns mark where evidence stops.'
  },
  {
    anchor: 'technical-proof',
    title: '6. Technical Proof & Next Action',
    badge: 'PROVENANCE & DEEP PROOF',
    content: 'Expand the Evidence inspector to inspect evidence records, collector details, and line-level provenance. You\'re ready to check your own AI projects!'
  }
];

export function OnboardingTour({
  active,
  stepIndex,
  onNext,
  onPrev,
  onClose,
  onFinish
}: {
  active: boolean;
  stepIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onFinish: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentStep = TOUR_STEPS[stepIndex] || TOUR_STEPS[0];
  const isLastStep = stepIndex === TOUR_STEPS.length - 1;

  useEffect(() => {
    if (!active) return;

    // Handle Escape key
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowRight' && !isLastStep) {
        onNext();
      } else if (event.key === 'ArrowLeft' && stepIndex > 0) {
        onPrev();
      } else if (event.key === 'Tab' && containerRef.current) {
        const controls = Array.from(containerRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(item => !item.hasAttribute('disabled'));
        if (!controls.length) return;
        const first = controls[0]; const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    // Find and scroll to target anchor
    let targetElement: Element | null = null;
    const targetTimer = window.setTimeout(() => {
      targetElement = document.querySelector(`[data-tour-anchor="${currentStep.anchor}"]`);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetElement.classList.add('tour-target-highlight');
      }
    }, 0);

    // Focus container for keyboard accessibility
    containerRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.clearTimeout(targetTimer);
      if (targetElement) {
        targetElement.classList.remove('tour-target-highlight');
      }
    };
  }, [active, stepIndex, currentStep.anchor, isLastStep, onNext, onPrev, onClose]);

  if (!active) return null;

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      role="dialog"
      aria-label={`Guided Tour: ${currentStep.title}`}
      className="fixed bottom-3 left-3 right-3 z-50 w-auto max-w-md rounded-xl border border-[#1E50C8]/40 bg-[#F6F3EC] p-5 shadow-2xl backdrop-blur-md outline-none transition-all sm:bottom-8 sm:left-auto sm:right-8 sm:w-full"
      data-tour-step={stepIndex + 1}
    >
      <div className="h-1 wood-header-strip absolute top-0 left-0 right-0 rounded-t-xl" />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 pt-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-[#1E50C8]/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[#1E50C8] border border-[#1E50C8]/30">
              {currentStep.badge || 'GUIDED TOUR'}
            </span>
            <span className="font-mono text-xs text-[#5C6068]">
              Step {stepIndex + 1} of {TOUR_STEPS.length}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-bold text-[#1A1D20] heading-font">
            {currentStep.title}
          </h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Close tour"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded p-2 text-[#5C6068] hover:bg-[#1A1D20]/10 hover:text-[#1A1D20] transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body */}
      <p className="mt-3 text-xs leading-relaxed text-[#1A1D20]">
        {currentStep.content}
      </p>

      {/* Footer Controls */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#1A1D20]/15 pt-4">
        <button
          onClick={onClose}
          className="min-h-[44px] px-3 text-xs font-semibold text-[#5C6068] hover:text-[#1A1D20] hover:underline cursor-pointer"
        >
          Skip tour
        </button>

        <div className="flex items-center gap-2">
          {stepIndex > 0 && (
            <button
              onClick={onPrev}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md border border-[#1A1D20]/20 bg-white px-3 py-2 text-xs font-bold text-[#1A1D20] hover:bg-[#F2EFE9] transition-all shadow-2xs cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </button>
          )}

          {isLastStep ? (
            <button
              onClick={onFinish}
              className="min-h-[44px] flex items-center justify-center rounded-md bg-[#1E50C8] px-4 py-2 text-xs font-bold text-white hover:bg-[#1640A8] transition-all shadow-sm cursor-pointer"
            >
              <FolderSearch className="h-4 w-4 mr-1.5" /> Analyze your own project
            </button>
          ) : (
            <button
              onClick={onNext}
              className="min-h-[44px] flex items-center justify-center rounded-md bg-[#1E50C8] px-4 py-2 text-xs font-bold text-white hover:bg-[#1640A8] transition-all shadow-sm cursor-pointer"
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
