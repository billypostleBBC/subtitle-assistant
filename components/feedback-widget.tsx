"use client";

import { useEffect, useRef, useState } from "react";

const FEEDBACK_FORM_URL = "https://forms.monday.com/forms/embed/ce9941c8cfaa07e229f46af6c98bfb49?r=use1";

export function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const triggerElement = triggerRef.current;
    document.body.style.overflow = "hidden";

    const closeButton = modalRef.current?.querySelector<HTMLButtonElement>(".feedback-modal-close");
    closeButton?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
        'button, iframe, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusableElements?.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      triggerElement?.focus();
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        className="feedback-trigger"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
      >
        Feedback
      </button>

      {isOpen && (
        <div
          className="feedback-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <div
            ref={modalRef}
            className="feedback-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-modal-title"
          >
            <div className="feedback-modal-header">
              <h2 id="feedback-modal-title">Share your feedback</h2>
              <button
                className="feedback-modal-close"
                type="button"
                aria-label="Close feedback form"
                onClick={() => setIsOpen(false)}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
            <iframe
              className="feedback-form"
              src={FEEDBACK_FORM_URL}
              title="Subtitle proofing and conversion feedback form"
            />
          </div>
        </div>
      )}
    </>
  );
}
