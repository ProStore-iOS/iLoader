import { useState } from "react";
import "./Modal.css";
export const Modal = ({
  pages,
  isOpen,
  close,
  sizeFit,
}: {
  pages: React.ReactNode[];
  isOpen: boolean;
  close?: () => void;
  sizeFit?: boolean;
}) => {
  const [currentPage, setCurrentPage] = useState(0);

  return (
    <>
      {isOpen && (
        <div className={`modal-container`}>
          <div className={`modal${sizeFit ? " size-fit" : ""}`}>
            {close && (
              <button
                className="modal-close"
                onClick={() => {
                  setCurrentPage(0);
                  close();
                }}
              >
                &#x2715;
              </button>
            )}
            <div className="modal-content">{pages[currentPage]}</div>
            {pages.length > 1 && (
              <div className="modal-circles">
                {pages.map((_, i) => (
                  <div
                    key={i}
                    className={`page-circle${
                      i == currentPage ? " active-page" : ""
                    }`}
                  />
                ))}
              </div>
            )}
            {pages.length > 1 && currentPage < pages.length - 1 && (
              <button
                className="modal-next"
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                Next &#x276F;
              </button>
            )}
            {currentPage > 0 && (
              <button
                className="modal-prev"
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                Prev &#x276E;
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
};
